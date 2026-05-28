from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------- Config ----------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-5-20250929')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')
ALERT_VOL_USD = float(os.environ.get('ALERT_VOLUME_THRESHOLD_USD', '50000'))
HOT_VOL_USD = float(os.environ.get('HOT_VOLUME_THRESHOLD_USD', '50000'))
NEW_AGE_HOURS = int(os.environ.get('NEW_AGE_HOURS', '24'))
SCAN_INTERVAL = int(os.environ.get('SCAN_INTERVAL_SECONDS', '300'))

# Pause/Resume Scanner
SCANNER_PAUSED = os.environ.get('SCANNER_PAUSED', 'false').lower() == 'true'

# Cron-style scheduling (format: "HH:MM" or "HH:MM,HH:MM" for multiple times)
# Example: "09:00,15:00,21:00" will send alerts at 9 AM, 3 PM, and 9 PM
CRON_SCHEDULE = os.environ.get('CRON_SCHEDULE', '').strip()

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Solana Meme Coin Screener")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("screener")

# ---------- DexScreener ----------
DS_BASE = "https://api.dexscreener.com"

# Simple in-memory cache for /api/tokens to avoid rate limits
_cache: Dict[str, Any] = {"tokens": None, "ts": 0}
_CACHE_TTL = 30  # seconds


async def _fetch_json(client_: httpx.AsyncClient, url: str) -> Any:
    try:
        r = await client_.get(url, timeout=20.0, headers={"Accept": "application/json"})
        if r.status_code == 200:
            return r.json()
        logger.warning(f"GET {url} -> {r.status_code}")
    except Exception as e:
        logger.warning(f"GET {url} failed: {e}")
    return None


def _chunk(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


async def _fetch_solana_token_universe(client_: httpx.AsyncClient) -> List[str]:
    """Fetch list of trending/boosted Solana token addresses from DexScreener."""
    urls = [
        f"{DS_BASE}/token-boosts/latest/v1",
        f"{DS_BASE}/token-boosts/top/v1",
        f"{DS_BASE}/token-profiles/latest/v1",
    ]
    results = await asyncio.gather(*[_fetch_json(client_, u) for u in urls])
    addrs: List[str] = []
    seen = set()
    for res in results:
        if not res:
            continue
        items = res if isinstance(res, list) else res.get("data", [])
        for it in items:
            if (it.get("chainId") or "").lower() == "solana":
                a = it.get("tokenAddress") or it.get("address")
                if a and a not in seen:
                    seen.add(a)
                    addrs.append(a)
    return addrs


async def _fetch_pairs_for_addresses(client_: httpx.AsyncClient, addrs: List[str]) -> List[Dict[str, Any]]:
    """DexScreener supports up to 30 addresses per call: /latest/dex/tokens/{a,b,c}"""
    all_pairs: List[Dict[str, Any]] = []
    for batch in _chunk(addrs, 30):
        url = f"{DS_BASE}/latest/dex/tokens/{','.join(batch)}"
        res = await _fetch_json(client_, url)
        if not res:
            continue
        pairs = res.get("pairs") or []
        if pairs:
            all_pairs.extend(pairs)
    return all_pairs


def _best_pair_per_token(pairs: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Pick highest-liquidity pair per base token address."""
    by_token: Dict[str, Dict[str, Any]] = {}
    for p in pairs:
        if (p.get("chainId") or "").lower() != "solana":
            continue
        base = p.get("baseToken") or {}
        addr = base.get("address")
        if not addr:
            continue
        liq = ((p.get("liquidity") or {}).get("usd")) or 0
        existing = by_token.get(addr)
        if not existing or liq > (((existing.get("liquidity") or {}).get("usd")) or 0):
            by_token[addr] = p
    return by_token


def _classify(token: Dict[str, Any]) -> str:
    vol24 = token.get("volume_24h_usd") or 0
    age_h = token.get("age_hours")
    is_new = age_h is not None and age_h <= NEW_AGE_HOURS
    is_hot = vol24 >= HOT_VOL_USD
    if is_new and is_hot:
        return "HOT_NEW"
    if is_new:
        return "NEW"
    if is_hot:
        return "HOT"
    return "NORMAL"


def _shape_token(pair: Dict[str, Any]) -> Dict[str, Any]:
    base = pair.get("baseToken") or {}
    txns = pair.get("txns") or {}
    h24 = txns.get("h24") or {}
    volume = pair.get("volume") or {}
    price_change = pair.get("priceChange") or {}
    liq = pair.get("liquidity") or {}
    info = pair.get("info") or {}
    socials = info.get("socials") or []
    websites = info.get("websites") or []

    created_ms = pair.get("pairCreatedAt")
    age_hours = None
    created_iso = None
    if created_ms:
        try:
            created_dt = datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc)
            created_iso = created_dt.isoformat()
            age_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600.0
        except Exception:
            pass

    tx_buys = int(h24.get("buys") or 0)
    tx_sells = int(h24.get("sells") or 0)
    tok = {
        "address": base.get("address"),
        "symbol": base.get("symbol") or "?",
        "name": base.get("name") or base.get("symbol") or "?",
        "icon": info.get("imageUrl"),
        "price_usd": float(pair.get("priceUsd") or 0),
        "price_change_24h": float(price_change.get("h24") or 0),
        "price_change_1h": float(price_change.get("h1") or 0),
        "volume_24h_usd": float(volume.get("h24") or 0),
        "volume_1h_usd": float(volume.get("h1") or 0),
        "liquidity_usd": float(liq.get("usd") or 0),
        "market_cap_usd": float(pair.get("marketCap") or 0),
        "fdv_usd": float(pair.get("fdv") or 0),
        "txns_24h_buys": tx_buys,
        "txns_24h_sells": tx_sells,
        "txns_24h_total": tx_buys + tx_sells,
        "holders": None,  # DexScreener doesn't provide holder count
        "pair_address": pair.get("pairAddress"),
        "dex_id": pair.get("dexId"),
        "url": pair.get("url"),
        "created_at": created_iso,
        "age_hours": age_hours,
        "socials": socials,
        "websites": websites,
    }
    tok["status"] = _classify(tok)
    return tok


async def _get_tokens_cached() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc).timestamp()
    if _cache["tokens"] is not None and (now - _cache["ts"]) < _CACHE_TTL:
        return _cache["tokens"]
    async with httpx.AsyncClient() as cx:
        addrs = await _fetch_solana_token_universe(cx)
        if not addrs:
            return _cache["tokens"] or []
        pairs = await _fetch_pairs_for_addresses(cx, addrs[:90])
    best = _best_pair_per_token(pairs)
    tokens = [_shape_token(p) for p in best.values()]
    tokens.sort(key=lambda t: t.get("volume_24h_usd") or 0, reverse=True)
    _cache["tokens"] = tokens
    _cache["ts"] = now
    return tokens


# ---------- Routes ----------
class TelegramConfigUpdate(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    alert_threshold_usd: Optional[float] = None


@api_router.get("/")
async def root():
    return {"service": "solana-meme-screener", "status": "ok"}


@api_router.get("/tokens")
async def list_tokens(
    filter: str = "all",
    min_volume: float = 0,
    search: Optional[str] = None,
    limit: int = 100,
):
    tokens = await _get_tokens_cached()
    f = (filter or "all").lower()
    if f == "new":
        tokens = [t for t in tokens if t["status"] in ("NEW", "HOT_NEW")]
    elif f == "hot":
        tokens = [t for t in tokens if t["status"] in ("HOT", "HOT_NEW")]
    elif f == "hot_new":
        tokens = [t for t in tokens if t["status"] == "HOT_NEW"]
    if min_volume and min_volume > 0:
        tokens = [t for t in tokens if (t.get("volume_24h_usd") or 0) >= min_volume]
    if search:
        q = search.lower().strip()
        tokens = [t for t in tokens if q in (t.get("symbol") or "").lower() or q in (t.get("name") or "").lower() or q in (t.get("address") or "").lower()]
    return {
        "tokens": tokens[:limit],
        "count": len(tokens[:limit]),
        "thresholds": {
            "hot_volume_usd": HOT_VOL_USD,
            "new_age_hours": NEW_AGE_HOURS,
            "alert_volume_usd": ALERT_VOL_USD,
        },
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/tokens/{address}")
async def get_token(address: str):
    tokens = await _get_tokens_cached()
    for t in tokens:
        if t.get("address") == address:
            return t
    # fallback: fetch fresh
    async with httpx.AsyncClient() as cx:
        pairs = await _fetch_pairs_for_addresses(cx, [address])
    best = _best_pair_per_token(pairs)
    if not best:
        raise HTTPException(404, "Token not found")
    return _shape_token(list(best.values())[0])


# ---------- AI Analysis (Anthropic) ----------
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

ANALYSIS_SYSTEM = (
    "You are a crypto market analyst specializing in Solana meme coins. "
    "You evaluate hype, community strength, and buy/sell signal based on the token data provided. "
    "You also use your knowledge of recent crypto trends, X/Twitter discourse patterns, and meme coin dynamics. "
    "Always respond with STRICT JSON only, no prose, no markdown fencing."
)

ANALYSIS_PROMPT_TEMPLATE = """Analyze this Solana meme coin and return a JSON object.

Token Data:
- Name: {name}
- Symbol: {symbol}
- Contract: {address}
- Price USD: {price}
- 24h Volume USD: {vol24}
- 24h Price Change %: {pc24}
- 1h Price Change %: {pc1}
- 24h Buys: {buys}
- 24h Sells: {sells}
- Liquidity USD: {liq}
- Market Cap USD: {mc}
- Age (hours): {age}
- Status: {status}
- Socials: {socials}

Return JSON with this exact schema:
{{
  "hype_score": <0-100 integer, how much hype/attention this coin appears to have>,
  "community_score": <0-100 integer, strength & engagement of community>,
  "buy_signal": <0-100 integer, likelihood this is a good entry (consider risk too)>,
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  "trend": "BULLISH" | "NEUTRAL" | "BEARISH",
  "verdict": "STRONG_BUY" | "BUY" | "HOLD" | "WATCH" | "AVOID",
  "summary": "<2-3 sentence summary in English>",
  "key_points": ["<3-6 short bullets covering hype, community, on-chain signals, risks>"],
  "twitter_searches": ["<3-5 X/Twitter search queries that surface relevant discussion>"],
  "red_flags": ["<0-4 short red flag bullets, empty array if none>"]
}}

Important: respond with ONLY the JSON object. No prose. No markdown."""


def _build_twitter_links(symbol: str, address: str, searches: List[str]) -> List[Dict[str, str]]:
    links: List[Dict[str, str]] = []
    seen = set()
    queries = list(searches or [])
    if symbol and len(symbol) <= 10:
        queries.insert(0, f"${symbol}")
    if address:
        queries.append(address)
    for q in queries:
        q = (q or "").strip()
        if not q or q in seen:
            continue
        seen.add(q)
        from urllib.parse import quote_plus
        links.append({
            "query": q,
            "url_live": f"https://x.com/search?q={quote_plus(q)}&f=live",
            "url_top": f"https://x.com/search?q={quote_plus(q)}&f=top",
        })
    return links


async def _call_anthropic(prompt: str) -> Dict[str, Any]:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured")
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 1500,
        "system": ANALYSIS_SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=60.0) as cx:
        r = await cx.post(ANTHROPIC_URL, headers=headers, json=body)
        if r.status_code != 200:
            logger.error(f"Anthropic error {r.status_code}: {r.text[:500]}")
            raise HTTPException(502, f"Anthropic API error: {r.status_code}")
        data = r.json()
    # extract text
    parts = data.get("content") or []
    text = ""
    for p in parts:
        if p.get("type") == "text":
            text += p.get("text") or ""
    text = text.strip()
    # strip code fences if model added any
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    # find first { ... last }
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end >= 0:
        text = text[start:end + 1]
    try:
        return json.loads(text)
    except Exception as e:
        logger.error(f"Failed to parse AI JSON: {e} -- text: {text[:500]}")
        raise HTTPException(502, "AI returned non-JSON response")


@api_router.post("/tokens/{address}/analyze")
async def analyze_token(address: str):
    # check cache first (15 min)
    cached = await db.analyses.find_one({"address": address}, {"_id": 0})
    if cached:
        try:
            ts = datetime.fromisoformat(cached["created_at"])
            if (datetime.now(timezone.utc) - ts) < timedelta(minutes=15):
                return cached
        except Exception:
            pass

    token = await get_token(address)
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        name=token.get("name"),
        symbol=token.get("symbol"),
        address=token.get("address"),
        price=token.get("price_usd"),
        vol24=token.get("volume_24h_usd"),
        pc24=token.get("price_change_24h"),
        pc1=token.get("price_change_1h"),
        buys=token.get("txns_24h_buys"),
        sells=token.get("txns_24h_sells"),
        liq=token.get("liquidity_usd"),
        mc=token.get("market_cap_usd"),
        age=round(token.get("age_hours") or 0, 1),
        status=token.get("status"),
        socials=json.dumps(token.get("socials") or [])[:400],
    )
    ai = await _call_anthropic(prompt)

    # sanitize/clamp
    def clamp(v, lo=0, hi=100):
        try:
            v = int(v)
        except Exception:
            v = 0
        return max(lo, min(hi, v))

    result = {
        "address": address,
        "symbol": token.get("symbol"),
        "name": token.get("name"),
        "hype_score": clamp(ai.get("hype_score")),
        "community_score": clamp(ai.get("community_score")),
        "buy_signal": clamp(ai.get("buy_signal")),
        "risk_level": ai.get("risk_level") or "MEDIUM",
        "trend": ai.get("trend") or "NEUTRAL",
        "verdict": ai.get("verdict") or "WATCH",
        "summary": ai.get("summary") or "",
        "key_points": ai.get("key_points") or [],
        "red_flags": ai.get("red_flags") or [],
        "twitter_searches": ai.get("twitter_searches") or [],
        "twitter_links": _build_twitter_links(
            token.get("symbol") or "",
            address,
            ai.get("twitter_searches") or [],
        ),
        "dexscreener_url": token.get("url"),
        "token_snapshot": {
            "price_usd": token.get("price_usd"),
            "volume_24h_usd": token.get("volume_24h_usd"),
            "market_cap_usd": token.get("market_cap_usd"),
            "liquidity_usd": token.get("liquidity_usd"),
            "price_change_24h": token.get("price_change_24h"),
            "age_hours": token.get("age_hours"),
            "status": token.get("status"),
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # upsert in mongo
    await db.analyses.update_one({"address": address}, {"$set": result}, upsert=True)
    return result


# ---------- Telegram ----------
@api_router.get("/telegram/config")
async def telegram_config():
    return {
        "bot_token_set": bool(TELEGRAM_BOT_TOKEN),
        "chat_id_set": bool(TELEGRAM_CHAT_ID),
        "alert_threshold_usd": ALERT_VOL_USD,
        "configured": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID),
    }


async def _send_telegram(text: str, parse_mode: str = "HTML") -> Dict[str, Any]:
    if not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
        raise HTTPException(400, "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend/.env")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": False,
    }
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(url, json=payload)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
        if r.status_code != 200 or not data.get("ok", False):
            raise HTTPException(502, f"Telegram error: {data}")
        return data


@api_router.post("/telegram/test")
async def telegram_test():
    msg = (
        "<b>Solana Meme Screener</b>\n"
        "Test alert: bot is connected and listening for volume spikes.\n"
        f"Alert threshold: ${ALERT_VOL_USD:,.0f}"
    )
    res = await _send_telegram(msg)
    return {"ok": True, "telegram_response": res}


def _format_alert(t: Dict[str, Any]) -> str:
    sym = t.get("symbol")
    name = t.get("name")
    vol = t.get("volume_24h_usd") or 0
    mc = t.get("market_cap_usd") or 0
    liq = t.get("liquidity_usd") or 0
    pc = t.get("price_change_24h") or 0
    price = t.get("price_usd") or 0
    status = t.get("status")
    addr = t.get("address")
    url = t.get("url") or f"https://dexscreener.com/solana/{addr}"
    return (
        f"<b>🔔 {status} — ${sym}</b>  {name}\n"
        f"Price: <code>${price:.8f}</code>\n"
        f"24h Vol: <b>${vol:,.0f}</b>\n"
        f"Market Cap: ${mc:,.0f}\n"
        f"Liquidity: ${liq:,.0f}\n"
        f"24h Change: {pc:+.2f}%\n"
        f"Contract: <code>{addr}</code>\n"
        f"<a href=\"{url}\">DexScreener →</a>"
    )


@api_router.post("/telegram/scan-and-alert")
async def telegram_scan_and_alert(threshold: Optional[float] = None):
    """Manual trigger: scan current tokens and send Telegram alerts for hot ones above threshold."""
    if not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
        raise HTTPException(400, "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in backend/.env")
    threshold = threshold or ALERT_VOL_USD
    tokens = await _get_tokens_cached()
    sent: List[str] = []
    skipped: List[str] = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    for t in tokens:
        vol = t.get("volume_24h_usd") or 0
        status = t.get("status")
        if vol < threshold and status not in ("HOT", "HOT_NEW"):
            continue
        addr = t.get("address")
        if not addr:
            continue
        prev = await db.telegram_sent.find_one({"address": addr}, {"_id": 0})
        if prev:
            try:
                last = datetime.fromisoformat(prev["last_sent"])
                if last > cutoff:
                    skipped.append(t.get("symbol") or addr)
                    continue
            except Exception:
                pass
        try:
            await _send_telegram(_format_alert(t))
            await db.telegram_sent.update_one(
                {"address": addr},
                {"$set": {"address": addr, "symbol": t.get("symbol"), "last_sent": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
            sent.append(t.get("symbol") or addr)
        except HTTPException as e:
            logger.warning(f"telegram send failed for {addr}: {e.detail}")
            break
        await asyncio.sleep(0.5)
    return {"sent": sent, "skipped": skipped, "threshold_usd": threshold}


# ---------- Background scanner ----------
def _parse_cron_times(cron_str: str) -> List[tuple]:
    """Parse cron times like '09:00,15:00,21:00' into [(9,0), (15,0), (21,0)]"""
    times = []
    if not cron_str:
        return times
    for part in cron_str.split(','):
        part = part.strip()
        if ':' in part:
            try:
                h, m = part.split(':')
                times.append((int(h), int(m)))
            except Exception:
                pass
    return times


def _should_run_cron_now(cron_times: List[tuple], last_run: datetime) -> bool:
    """Check if current time matches any cron schedule and hasn't run in last hour"""
    now = datetime.now(timezone.utc)
    if (now - last_run).total_seconds() < 3600:  # cooldown 1 hour
        return False
    now_hm = (now.hour, now.minute)
    for (h, m) in cron_times:
        if now_hm == (h, m):
            return True
    return False


async def _background_scanner():
    await asyncio.sleep(15)  # give app time to settle
    last_cron_run = datetime.min.replace(tzinfo=timezone.utc)
    cron_times = _parse_cron_times(CRON_SCHEDULE)
    
    logger.info(f"🤖 Background scanner started. PAUSED={SCANNER_PAUSED}, INTERVAL={SCAN_INTERVAL}s, CRON={CRON_SCHEDULE or 'disabled'}")
    
    while True:
        try:
            if SCANNER_PAUSED:
                logger.debug("Scanner is PAUSED, skipping...")
            elif not (TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID):
                logger.debug("Telegram not configured, skipping...")
            else:
                # Cron mode takes priority over interval mode
                if cron_times:
                    if _should_run_cron_now(cron_times, last_cron_run):
                        logger.info(f"⏰ Cron trigger at {datetime.now(timezone.utc).strftime('%H:%M UTC')}")
                        await telegram_scan_and_alert()
                        last_cron_run = datetime.now(timezone.utc)
                else:
                    # Interval mode
                    logger.info(f"🔄 Interval scan triggered (every {SCAN_INTERVAL}s)")
                    await telegram_scan_and_alert()
        except Exception as e:
            logger.warning(f"background scanner error: {e}")
        
        # Sleep 60s if cron mode, otherwise use SCAN_INTERVAL
        sleep_duration = 60 if cron_times else SCAN_INTERVAL
        await asyncio.sleep(sleep_duration)


@app.on_event("startup")
async def _startup():
    asyncio.create_task(_background_scanner())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
