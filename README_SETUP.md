# 🚀 Solana Meme Coin Screener - Setup Guide

## 📁 Struktur Proyek

```
/app/
├── backend/              # FastAPI Backend
│   ├── .env             # ⚙️ Config utama (ISI INI!)
│   ├── .env.example     # 📄 Template
│   ├── server.py        # Server utama
│   └── requirements.txt
├── frontend/            # React Frontend
│   ├── .env            # Frontend config (JANGAN UBAH)
│   ├── src/
│   └── package.json
├── TELEGRAM_SETUP.md   # 📱 Tutorial Telegram lengkap
└── README_SETUP.md     # 📖 File ini
```

---

## ⚡ Quick Start

### 1️⃣ **Install Dependencies** (Jika belum)

```bash
# Backend
cd /app/backend
pip install -r requirements.txt

# Frontend
cd /app/frontend
yarn install
```

### 2️⃣ **Setup Environment**

Edit file: `/app/backend/.env`

**Minimal Config (Tanpa Telegram):**
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
ANTHROPIC_API_KEY="<sudah terisi>"
ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
SCANNER_PAUSED="false"
```

**Full Config (Dengan Telegram Alert):**
```env
# ... config di atas ...
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="987654321"
SCAN_INTERVAL_SECONDS="300"
CRON_SCHEDULE=""
```

📖 **Tutorial lengkap:** Lihat `/app/TELEGRAM_SETUP.md`

### 3️⃣ **Running Aplikasi**

```bash
# Restart semua services
sudo supervisorctl restart all

# Cek status
sudo supervisorctl status

# Output:
# backend    RUNNING
# frontend   RUNNING
# mongodb    RUNNING
```

### 4️⃣ **Akses Aplikasi**

- **🌐 Web UI:** https://setup-walkthrough-5.preview.emergentagent.com
- **🔌 API Docs:** https://setup-walkthrough-5.preview.emergentagent.com/docs
- **📊 API Endpoint:** `/api/tokens`, `/api/tokens/{address}`, `/api/tokens/{address}/analyze`

---

## 🎛️ Konfigurasi Penting

### **A. File .env Backend**

| Variable | Wajib? | Deskripsi | Contoh |
|----------|--------|-----------|--------|
| `TELEGRAM_BOT_TOKEN` | ❌ Opsional | Token dari @BotFather | `"123456:ABC..."` |
| `TELEGRAM_CHAT_ID` | ❌ Opsional | ID chat tujuan | `"987654321"` |
| `SCANNER_PAUSED` | ✅ Ya | Pause scanner? | `"false"` |
| `SCAN_INTERVAL_SECONDS` | ✅ Ya | Interval scan (detik) | `"300"` |
| `CRON_SCHEDULE` | ❌ Opsional | Jadwal spesifik (UTC) | `"09:00,15:00"` |
| `ALERT_VOLUME_THRESHOLD_USD` | ✅ Ya | Min. volume alert | `"50000"` |

### **B. File .env Frontend**

**⚠️ JANGAN DIUBAH:**
```env
REACT_APP_BACKEND_URL=https://setup-walkthrough-5.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

---

## 📱 Setup Telegram Alert

### **Step 1: Buat Bot**
1. Chat [@BotFather](https://t.me/BotFather) di Telegram
2. Ketik: `/newbot`
3. Beri nama bot
4. Copy **TOKEN** (format: `1234567890:ABCdef...`)

### **Step 2: Dapatkan Chat ID**

**Untuk Personal Chat:**
```bash
# 1. Kirim pesan ke bot Anda
# 2. Buka URL ini di browser:
https://api.telegram.org/bot<TOKEN>/getUpdates

# 3. Cari "chat":{"id": 123456789}
# 4. Copy angka ID
```

**Untuk Group Chat:**
```bash
# 1. Tambahkan bot ke group
# 2. Kirim: /start
# 3. Buka URL yang sama
# 4. Cari "chat":{"id": -1001234567890}
# 5. Copy ID (termasuk minus)
```

### **Step 3: Update .env**
```env
TELEGRAM_BOT_TOKEN="<token dari step 1>"
TELEGRAM_CHAT_ID="<id dari step 2>"
```

### **Step 4: Restart & Test**
```bash
sudo supervisorctl restart backend

# Test via UI: Klik tombol "Send Test" di Telegram Config
# Atau via curl:
curl -X POST http://localhost:8001/api/telegram/test
```

---

## ⏰ Scheduling Mode

### **Mode 1: Interval (Default)**
Scanner berjalan setiap X detik:

```env
SCAN_INTERVAL_SECONDS="600"  # Setiap 10 menit
CRON_SCHEDULE=""             # Kosong = pakai interval
```

### **Mode 2: Cron Schedule**
Scanner hanya di waktu tertentu (UTC timezone):

```env
SCAN_INTERVAL_SECONDS="300"  # Diabaikan saat cron aktif
CRON_SCHEDULE="02:00,08:00,14:00"  # WIB: 09:00, 15:00, 21:00
```

**Konversi WIB → UTC:**
```
WIB 06:00 → UTC 23:00 (hari sebelumnya)
WIB 09:00 → UTC 02:00
WIB 12:00 → UTC 05:00
WIB 15:00 → UTC 08:00
WIB 18:00 → UTC 11:00
WIB 21:00 → UTC 14:00
```

---

## 🛠️ Troubleshooting

### **Issue: Frontend error "ERR_CONNECTION_REFUSED"**

**Solusi:**
1. Cek backend running:
   ```bash
   sudo supervisorctl status backend
   ```

2. Test API langsung:
   ```bash
   curl http://localhost:8001/api/tokens?limit=1
   ```

3. Restart frontend:
   ```bash
   sudo supervisorctl restart frontend
   ```

4. Clear browser cache (Ctrl+Shift+R)

### **Issue: Telegram tidak terkirim**

**Cek:**
1. `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` terisi?
   ```bash
   cat /app/backend/.env | grep TELEGRAM
   ```

2. Scanner tidak di-pause?
   ```bash
   cat /app/backend/.env | grep SCANNER_PAUSED
   # Harus: SCANNER_PAUSED="false"
   ```

3. Ada token yang memenuhi threshold?
   ```bash
   curl "http://localhost:8001/api/tokens?filter=hot&limit=5"
   ```

4. Lihat log:
   ```bash
   tail -f /var/log/supervisor/backend.err.log | grep "telegram\|Background"
   ```

### **Issue: Cron schedule tidak jalan**

**Cek:**
1. Format cron benar? (HH:MM, 24-hour UTC)
   ```env
   CRON_SCHEDULE="09:00,15:00"  # ✅ Benar
   CRON_SCHEDULE="9:00,15:00"   # ❌ Salah (harus 09:00)
   CRON_SCHEDULE="09:00 15:00"  # ❌ Salah (pakai koma)
   ```

2. Lihat log trigger:
   ```bash
   tail -f /var/log/supervisor/backend.err.log | grep "Cron trigger"
   ```

---

## 📊 Monitoring

### **Backend Logs**
```bash
# Real-time logs
tail -f /var/log/supervisor/backend.err.log

# Filter scanner logs
tail -f /var/log/supervisor/backend.err.log | grep "Background scanner\|Interval\|Cron"

# API request logs
tail -f /var/log/supervisor/backend.out.log
```

### **Frontend Logs**
```bash
# Webpack compilation logs
tail -f /var/log/supervisor/frontend.out.log

# Error logs
tail -f /var/log/supervisor/frontend.err.log
```

### **Services Status**
```bash
# Cek semua services
sudo supervisorctl status

# Restart specific service
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Restart all
sudo supervisorctl restart all
```

---

## 🎯 Fitur Aplikasi

✅ **Live Token Screening** - Real-time data dari DexScreener  
✅ **Status Labels** - NEW, HOT, HOT_NEW, NORMAL  
✅ **AI Analysis** - Sentiment & hype detection (Claude Sonnet)  
✅ **Telegram Alerts** - Auto-push untuk high-volume tokens  
✅ **Flexible Scheduling** - Interval atau Cron mode  
✅ **Pause/Resume** - Control scanner on-the-fly  
✅ **Dark Terminal UI** - Cyberpunk-inspired design  

---

## 🔒 Security Notes

1. **JANGAN commit .env ke git!**
   - File `.gitignore` sudah include `.env`

2. **Telegram Token adalah rahasia**
   - Jangan share ke orang lain
   - Regenerate jika bocor (via @BotFather)

3. **API Rate Limits**
   - DexScreener: cache 30 detik
   - Anthropic: rate limit per API key

---

## 📞 Support

**Dokumentasi:**
- Setup Telegram: `/app/TELEGRAM_SETUP.md`
- Example Config: `/app/backend/.env.example`
- API Docs: `https://<your-url>/docs`

**Logs Location:**
- Backend: `/var/log/supervisor/backend.*.log`
- Frontend: `/var/log/supervisor/frontend.*.log`

**Common Commands:**
```bash
# Restart services
sudo supervisorctl restart all

# Check status
sudo supervisorctl status

# View logs
tail -f /var/log/supervisor/backend.err.log

# Test API
curl http://localhost:8001/api/tokens?limit=1
```

---

Made with ❤️ using Emergent.sh
