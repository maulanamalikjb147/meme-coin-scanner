# SOL/SCREENER — Solana Meme Coin Radar

Dashboard real-time untuk screening meme coin di jaringan Solana, dengan label otomatis **NEW / HOT / HOT • NEW**, AI Analyze (Anthropic Claude), dan alert otomatis ke Telegram bot saat ada lonjakan volume.

![preview](https://static.prod-images.emergentagent.com/jobs/e163a39e-101d-4d27-ba1f-7dc7d5c0d32e/images/ca0a8983f618abb11fac587cb370e8b230cbbfcb6afaf8b70071ce4278a617b6.png)

---

## ✨ Fitur Utama

- **Live screener** 50+ Solana meme coins dari DexScreener (auto-refresh tiap 30 detik).
- **Auto-label**:
  - `NEW` — token listing ≤ 24 jam
  - `HOT` — volume 24h ≥ $50.000
  - `HOT • NEW` — kedua kriteria terpenuhi
- **Filter & search** by simbol, nama, contract, atau min-volume.
- **Tombol `Analyze` per token** → AI Anthropic Claude `claude-sonnet-4-5` mengembalikan:
  - Hype Score (0-100) — indikator gauge
  - Community Score (0-100) — indikator gauge
  - Buy Signal (0-100) — indikator gauge
  - Verdict (`STRONG_BUY` / `BUY` / `HOLD` / `WATCH` / `AVOID`)
  - Risk Level (`LOW` / `MEDIUM` / `HIGH` / `EXTREME`)
  - AI Summary + Key Signals + Red Flags
  - Link pencarian X/Twitter (Live & Top) untuk verifikasi sentimen
- **Telegram Bot Alerts** otomatis tiap 5 menit untuk token HOT (anti-spam: cooldown 6 jam per token).
- **Link DexScreener** di setiap baris untuk lanjut analisa chart & holder.

---

## 🧰 Prasyarat

| Tool | Versi minimal | Cek |
|------|---------------|-----|
| Python | 3.10+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| Yarn | 1.22+ | `yarn --version` (jangan pakai npm) |
| MongoDB | 4.4+ (local atau Atlas) | `mongod --version` |

> **MongoDB**: instal lokal (`brew install mongodb-community` / `apt install mongodb`) **atau** pakai MongoDB Atlas gratis dan masukkan connection string-nya ke `.env`.

---

## 📁 Struktur Project

```
/app
├── backend/
│   ├── server.py           # FastAPI (semua endpoint)
│   ├── requirements.txt    # Python deps
│   └── .env                # ⬅ env backend (taruh di sini)
├── frontend/
│   ├── src/                # React app
│   ├── package.json
│   └── .env                # ⬅ env frontend (taruh di sini)
└── README.md
```

---

## 🚀 Cara Running di Local

### 1. Clone & masuk ke folder

```bash
git clone <repo-url> sol-screener
cd sol-screener
```

### 2. Setup Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate                  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Buat / edit file **`/app/backend/.env`** (sudah ada template-nya):

```ini
# === MongoDB ===
MONGO_URL="mongodb://localhost:27017"
DB_NAME="sol_screener"
CORS_ORIGINS="*"

# === Anthropic Claude (sudah diisi) ===
ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxx"
ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"

# === Telegram Bot — isi sendiri ===
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# === Threshold (boleh diubah) ===
ALERT_VOLUME_THRESHOLD_USD="50000"   # min volume USD untuk kirim alert ke Telegram
HOT_VOLUME_THRESHOLD_USD="50000"     # min volume USD untuk dikategorikan HOT
NEW_AGE_HOURS="24"                   # umur maks untuk dikategorikan NEW (jam)
SCAN_INTERVAL_SECONDS="300"          # interval background scanner (detik) -> default 5 menit
```

Jalankan backend:

```bash
# dari /app/backend
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Backend akan jalan di `http://localhost:8001`. Test:

```bash
curl http://localhost:8001/api/tokens?limit=3
```

### 3. Setup Frontend (React)

Buka terminal baru:

```bash
cd frontend
yarn install
```

Buat / edit file **`/app/frontend/.env`**:

```ini
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=0
```

> **Penting**: jangan ada trailing slash di `REACT_APP_BACKEND_URL`. Frontend otomatis prepend `/api`.

Jalankan frontend:

```bash
yarn start
```

Buka `http://localhost:3000` di browser. Selesai 🎉

---

## 🤖 Setup Telegram Bot

### Step 1 — Buat bot baru

1. Buka Telegram, search **`@BotFather`**.
2. Kirim `/newbot` → ikuti instruksi (kasih nama & username).
3. BotFather akan kasih token seperti:
   ```
   7891234567:AAH7xyz...XYZ
   ```
   Itu yang masuk ke `TELEGRAM_BOT_TOKEN`.

### Step 2 — Dapatkan Chat ID

**Opsi A — Personal chat (alert ke diri sendiri):**
1. Kirim pesan apa saja ke bot kamu (misal: "halo").
2. Buka di browser:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   Ganti `<TOKEN>` dengan token bot kamu.
3. Cari field `"chat":{"id":123456789, ...}`. Angka itulah `TELEGRAM_CHAT_ID`.

**Opsi B — Group/Channel:**
1. Tambahkan bot ke group.
2. Kirim 1 pesan di group.
3. Hit `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id` (negatif untuk group, format `-100xxxxxxxxxx` untuk channel).

### Step 3 — Masukkan ke `.env`

```ini
TELEGRAM_BOT_TOKEN="7891234567:AAH7xyz...XYZ"
TELEGRAM_CHAT_ID="123456789"
```

### Step 4 — Restart backend

```bash
# Ctrl+C dulu di terminal backend, lalu:
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Step 5 — Test dari UI

1. Buka dashboard `http://localhost:3000`.
2. Klik tombol **`Telegram`** di kanan atas.
3. Pastikan **Bot Token** & **Chat ID** keduanya `SET ✓` (hijau).
4. Klik **`Send Test`** → cek Telegram, harusnya muncul pesan:
   > **Solana Meme Screener**
   > Test alert: bot is connected and listening for volume spikes.

5. Klik **`Scan & Alert Now`** → mengirim alert langsung untuk semua token HOT saat ini.

### Step 6 — Background scanner otomatis

Setelah Telegram terkonfigurasi, scanner berjalan otomatis tiap **`SCAN_INTERVAL_SECONDS`** (default 5 menit). Token akan dikirim jika:
- Status `HOT` atau `HOT_NEW`, **DAN**
- Volume 24h ≥ `ALERT_VOLUME_THRESHOLD_USD`, **DAN**
- Token tersebut belum di-alert dalam 6 jam terakhir (anti-spam).

Format pesan alert:
```
🔔 HOT_NEW — $SYMBOL  Token Name
Price: $0.00001234
24h Vol: $250,000
Market Cap: $1,200,000
Liquidity: $45,000
24h Change: +152.34%
Contract: ABC123...XYZ
[ DexScreener → ]
```

---

## 🧠 Cara Pakai Tombol `Analyze`

1. Di tabel utama, klik **`Analyze`** di kolom Actions pada token mana saja.
2. Panel kanan terbuka — Claude menganalisa selama 3-10 detik.
3. Lihat 3 gauge: **Hype**, **Community**, **Buy Signal**.
4. Baca **AI Summary**, **Key Signals**, **Red Flags**.
5. Klik link **Live / Top** di seksi **X / Twitter Signals** untuk buka pencarian X/Twitter terkait token tersebut.
6. Klik **DexScreener →** di bagian bawah untuk lanjut analisa chart & holder.
7. Hasil analisa di-cache 15 menit (klik **Re-run** untuk paksa refresh).

---

## 🔌 API Endpoints (untuk dev)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/tokens?filter=all\|new\|hot\|hot_new&min_volume=0&search=&limit=100` | List token + filter |
| GET | `/api/tokens/{address}` | Detail 1 token |
| POST | `/api/tokens/{address}/analyze` | Trigger AI analysis (cached 15 menit) |
| GET | `/api/telegram/config` | Status konfigurasi Telegram |
| POST | `/api/telegram/test` | Kirim pesan test ke Telegram |
| POST | `/api/telegram/scan-and-alert?threshold=50000` | Manual scan & alert |

---

## ⚙️ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `count: 0` saat hit `/api/tokens` | Tunggu 5-10 detik, DexScreener masih dipanggil pertama kali. Refresh. |
| `Telegram is not configured` | `.env` belum terisi atau backend belum di-restart setelah edit `.env`. |
| Bot Telegram tidak kirim apa-apa | Cek: (1) token benar, (2) chat ID benar, (3) sudah pernah kirim 1 pesan ke bot dulu. |
| `AI returned non-JSON response` | Anthropic kadang return wrapped JSON. Coba klik **Re-run**. |
| Frontend blank | Pastikan `REACT_APP_BACKEND_URL` cocok dengan URL backend (tanpa trailing slash). |
| MongoDB connection error | Cek `MONGO_URL` di `.env`, pastikan `mongod` jalan atau Atlas URI valid. |

Cek log backend:
```bash
# kalau pakai supervisor:
tail -f /var/log/supervisor/backend.err.log

# kalau jalan manual:
# log muncul di terminal tempat uvicorn berjalan
```

---

## 🛠 Stack

- **Backend**: FastAPI · Motor (MongoDB async) · httpx
- **Frontend**: React 19 · TailwindCSS · shadcn/ui · sonner · lucide-react
- **Data**: DexScreener REST API (gratis, no key)
- **AI**: Anthropic Claude `claude-sonnet-4-5-20250929`
- **Alerts**: Telegram Bot API

---

## 📝 Lisensi

Personal / educational use. Tidak ada jaminan finansial — **DYOR (Do Your Own Research)** sebelum trading.
