"""Backend tests for Solana meme coin screener."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://meme-coin-dashboard-1.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Root ----------
class TestRoot:
    def test_root(self, session):
        r = session.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "solana-meme-screener"


# ---------- Tokens listing & filters ----------
class TestTokensList:
    def test_list_tokens_all(self, session):
        r = session.get(f"{API}/tokens", timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "tokens" in data and "count" in data and "thresholds" in data and "updated_at" in data
        assert isinstance(data["tokens"], list)
        # may be empty if upstream rate-limited, but normally we expect tokens
        if data["tokens"]:
            t = data["tokens"][0]
            for k in ("address", "symbol", "name", "price_usd", "volume_24h_usd", "status", "holders"):
                assert k in t, f"missing key {k} in token"
            assert t["status"] in ("NEW", "HOT", "HOT_NEW", "NORMAL")
            assert t["holders"] is None  # DexScreener doesn't provide holders
        # thresholds
        th = data["thresholds"]
        assert th["hot_volume_usd"] == 50000
        assert th["new_age_hours"] == 24
        assert th["alert_volume_usd"] == 50000

    def test_filter_hot(self, session):
        r = session.get(f"{API}/tokens", params={"filter": "hot"}, timeout=60)
        assert r.status_code == 200
        for t in r.json()["tokens"]:
            assert t["status"] in ("HOT", "HOT_NEW")

    def test_filter_new(self, session):
        r = session.get(f"{API}/tokens", params={"filter": "new"}, timeout=60)
        assert r.status_code == 200
        for t in r.json()["tokens"]:
            assert t["status"] in ("NEW", "HOT_NEW")

    def test_filter_hot_new(self, session):
        r = session.get(f"{API}/tokens", params={"filter": "hot_new"}, timeout=60)
        assert r.status_code == 200
        for t in r.json()["tokens"]:
            assert t["status"] == "HOT_NEW"

    def test_min_volume(self, session):
        r = session.get(f"{API}/tokens", params={"min_volume": 100000}, timeout=60)
        assert r.status_code == 200
        for t in r.json()["tokens"]:
            assert (t.get("volume_24h_usd") or 0) >= 100000

    def test_search(self, session):
        r = session.get(f"{API}/tokens", params={"search": "BONK"}, timeout=60)
        assert r.status_code == 200
        for t in r.json()["tokens"]:
            blob = f"{t.get('symbol','')} {t.get('name','')} {t.get('address','')}".lower()
            assert "bonk" in blob

    def test_limit(self, session):
        r = session.get(f"{API}/tokens", params={"limit": 5}, timeout=60)
        assert r.status_code == 200
        assert len(r.json()["tokens"]) <= 5


# ---------- Token detail ----------
class TestTokenDetail:
    def test_get_token_existing(self, session):
        list_r = session.get(f"{API}/tokens", params={"limit": 3}, timeout=60).json()
        if not list_r["tokens"]:
            pytest.skip("no upstream tokens to test detail")
        addr = list_r["tokens"][0]["address"]
        r = session.get(f"{API}/tokens/{addr}", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["address"] == addr
        assert "status" in data

    def test_get_token_invalid(self, session):
        # invalid address — DexScreener returns no pairs => 404
        r = session.get(f"{API}/tokens/INVALID_ADDRESS_xxxxx", timeout=30)
        assert r.status_code in (404, 502)


# ---------- AI Analysis ----------
class TestAnalyze:
    @pytest.fixture(scope="class")
    def picked_addr(self, session):
        list_r = session.get(f"{API}/tokens", params={"limit": 5}, timeout=60).json()
        if not list_r["tokens"]:
            pytest.skip("no upstream tokens to analyze")
        return list_r["tokens"][0]["address"]

    def test_analyze_returns_schema(self, session, picked_addr):
        r = session.post(f"{API}/tokens/{picked_addr}/analyze", timeout=120)
        assert r.status_code == 200, f"body: {r.text[:400]}"
        data = r.json()
        for k in ("hype_score", "community_score", "buy_signal", "verdict",
                  "risk_level", "summary", "key_points", "twitter_links"):
            assert k in data, f"missing key {k}"
        for k in ("hype_score", "community_score", "buy_signal"):
            assert 0 <= data[k] <= 100
        assert data["verdict"] in ("STRONG_BUY", "BUY", "HOLD", "WATCH", "AVOID")
        assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH", "EXTREME")
        assert isinstance(data["twitter_links"], list)
        if data["twitter_links"]:
            assert "url_live" in data["twitter_links"][0]

    def test_analyze_cached(self, session, picked_addr):
        # second call should be much faster (cached for 15 min)
        t0 = time.time()
        r = session.post(f"{API}/tokens/{picked_addr}/analyze", timeout=60)
        dt = time.time() - t0
        assert r.status_code == 200
        # cached should respond in < 3s typically
        assert dt < 5, f"Second call took {dt:.2f}s — caching might not be working"
        assert "_id" not in r.json(), "MongoDB _id leaked to response"


# ---------- Telegram ----------
class TestTelegram:
    def test_config_returns_unconfigured(self, session):
        r = session.get(f"{API}/telegram/config", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["configured"] is False
        assert data["bot_token_set"] is False
        assert data["chat_id_set"] is False
        assert data["alert_threshold_usd"] == 50000

    def test_telegram_test_unconfigured(self, session):
        r = session.post(f"{API}/telegram/test", timeout=20)
        assert r.status_code == 400
        assert "not configured" in r.text.lower()

    def test_scan_and_alert_unconfigured(self, session):
        # Should not 500 — graceful return. Since no tokens are HOT/HOT_NEW above threshold
        # OR there are some but telegram unconfigured triggers HTTPException(400).
        # Our impl catches HTTPException inside loop, but the FIRST telegram send raises
        # and is caught & breaks. So endpoint returns 200 with sent=[].
        r = session.post(f"{API}/telegram/scan-and-alert", timeout=60)
        # Either returns 200 with empty sent (graceful) — that's acceptable
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            data = r.json()
            assert "sent" in data and "skipped" in data
            assert data["sent"] == []  # no actual sends since telegram unconfigured
