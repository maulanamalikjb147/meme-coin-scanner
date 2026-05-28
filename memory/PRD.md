# Solana Meme Coin Screener — PRD

## Original Problem Statement
Dashboard untuk screening meme coin di jaringan Solana, baik yang baru listing maupun yang sudah ada.
Beri label `NEW` untuk listing baru, `HOT` untuk yang ramai transaksi/volume, `HOT NEW` jika memenuhi keduanya.
Scrape volume transaksi besar dan total holders kalau memungkinkan. Kirim alert ke Telegram bot
untuk coin dengan volume besar (threshold USDT) atau yang sedang hype, plus link ke source code
analisa lebih lanjut. Tambahkan tombol `Analyze` per token yang memanggil AI Anthropic untuk
mendeteksi hype, sentimen komunitas, dan sinyal beli (persentase + indikator visual), termasuk
scrape postingan X/Twitter terkait dengan link. Token bot Telegram & chat ID dimasukkan via `.env`.

## Architecture
- **Backend**: FastAPI (single-file `server.py`) + Motor (MongoDB) + httpx async client.
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts/SVG custom gauges + sonner toasts.
- **Data sources**:
  - DexScreener REST (token boosts, profiles, pair data) — primary on-chain feed.
  - Anthropic Claude `claude-sonnet-4-5-20250929` via direct HTTPS — AI analysis.
  - Telegram Bot HTTPS API — alert push.
- **Background worker**: `asyncio.create_task` loop in startup (every `SCAN_INTERVAL_SECONDS`, default 300s) runs `_scan_and_alert` if Telegram is configured.
- **Persistence**: MongoDB collections `analyses` (15-min cache of AI results) and `telegram_sent` (6-hour cooldown dedup per token).

## Core Requirements (locked)
1. Live screener of Solana meme coins with sortable columns: price, 24h Δ, 24h volume, liquidity, market cap, 24h tx (buy/sell), age, status.
2. Status labels: `NEW`, `HOT`, `HOT_NEW`, `NORMAL` derived from configurable thresholds.
3. Per-token `Analyze` → Anthropic Claude returns hype / community / buy-signal (0-100) shown as circular gauges + verdict + summary + key signals + red flags + X/Twitter search links.
4. Per-token outbound link to DexScreener for deeper trend analysis.
5. Telegram alert bot — push when volume ≥ alert threshold OR token classified HOT/HOT_NEW; dedup per token 6h; manual test & scan endpoints.
6. All Telegram credentials and thresholds configurable via `.env`.

## User Personas
- **Solana meme trader**: scans for high-momentum / freshly listed tokens.
- **Telegram alert subscriber**: passive — receives push when volume spikes.

## Implemented (2026-05-28)
- `GET /api/tokens` with `filter`, `min_volume`, `search`, `limit` params.
- `GET /api/tokens/{address}` single token detail + fallback fetch.
- `POST /api/tokens/{address}/analyze` Anthropic Claude integration, JSON-strict, 15-min Mongo cache.
- `GET /api/telegram/config`, `POST /api/telegram/test`, `POST /api/telegram/scan-and-alert`.
- Background scanner (5 min interval) auto-pushes alerts when Telegram is configured.
- Terminal-inspired dark UI: JetBrains Mono + IBM Plex Sans, neon green/orange/cyan accents,
  asymmetric/dense layout, circular SVG gauges with glow.
- Full data-testid coverage; verified by testing subagent (backend 15/15, frontend pass).

## Prioritized Backlog
- P1: Add Solscan/Helius holder count integration (currently `—`).
- P1: TTL index on `analyses.created_at` for automatic cache eviction.
- P2: Persist user-configurable thresholds in MongoDB so they survive without env edits.
- P2: Token watchlist (star icon) per user + dedicated tab.
- P2: Price chart sparkline in row (using DexScreener historical pairs).
- P2: Module split (`server.py` → `dexscreener.py`, `ai.py`, `telegram.py`).
- P3: Multi-chain extension (Base, BSC) with chain selector.

## Next Tasks
1. Wire holders via Solscan public API (free key).
2. Add Mongo TTL index on `analyses.created_at`.
3. Optional: in-app threshold editor.
