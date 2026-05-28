# 📱 Panduan Setup Telegram Alert & Scheduling

## 🔧 Konfigurasi .env Backend

File: `/app/backend/.env`

### 1️⃣ **Telegram Credentials (WAJIB untuk notifikasi)**

```env
# Dapatkan dari @BotFather
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"

# Chat ID tujuan alert (bisa personal chat atau group)
TELEGRAM_CHAT_ID="987654321"
```

**Cara Mendapatkan:**

#### **A. Bot Token**
1. Buka Telegram, chat dengan [@BotFather](https://t.me/BotFather)
2. Kirim perintah: `/newbot`
3. Ikuti instruksi (beri nama bot)
4. Copy **TOKEN** yang diberikan (format: `1234567890:ABCdef...`)

#### **B. Chat ID**
1. **Untuk Personal Chat:**
   - Kirim pesan apa saja ke bot Anda
   - Buka browser: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Cari `"chat":{"id": 123456789}`
   - Copy angka ID tersebut

2. **Untuk Group Chat:**
   - Tambahkan bot ke group
   - Kirim pesan di group: `/start`
   - Buka: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Cari `"chat":{"id": -1001234567890}` (group ID dimulai dengan -)
   - Copy angka ID (termasuk minus)

---

### 2️⃣ **Pause/Resume Scanner**

```env
# Set "true" untuk pause scanner, "false" untuk aktif
SCANNER_PAUSED="false"
```

**Use Case:**
- Pause saat maintenance: `SCANNER_PAUSED="true"`
- Resume scanning: `SCANNER_PAUSED="false"`

---

### 3️⃣ **Scheduling Mode**

Ada **2 mode** scheduling:

#### **Mode A: Interval (Default)**
Scanner berjalan setiap X detik.

```env
SCAN_INTERVAL_SECONDS="300"  # Kirim alert setiap 5 menit
CRON_SCHEDULE=""             # Kosongkan untuk pakai interval
```

**Contoh Interval:**
- `300` = 5 menit
- `600` = 10 menit
- `1800` = 30 menit
- `3600` = 1 jam

#### **Mode B: Cron Schedule (Waktu Spesifik)**
Scanner hanya berjalan di waktu yang ditentukan (format 24 jam UTC).

```env
SCAN_INTERVAL_SECONDS="300"  # Diabaikan jika cron aktif
CRON_SCHEDULE="09:00,15:00,21:00"  # Kirim alert jam 9 pagi, 3 sore, 9 malam UTC
```

**Format Cron:**
- Single time: `"09:00"` → Kirim jam 9 pagi UTC saja
- Multiple times: `"09:00,15:00,21:00"` → Kirim 3x sehari
- Pisahkan dengan koma (`,`) tanpa spasi

**Contoh Jadwal:**
```env
# Pagi, siang, malam
CRON_SCHEDULE="06:00,12:00,18:00"

# Setiap 4 jam
CRON_SCHEDULE="00:00,04:00,08:00,12:00,16:00,20:00"

# Jam kerja saja
CRON_SCHEDULE="09:00,12:00,15:00,18:00"
```

**⚠️ Catatan Timezone:**
- Semua waktu dalam **UTC**
- WIB = UTC+7 (jadi UTC 02:00 = WIB 09:00)
- WITA = UTC+8
- WIT = UTC+9

**Konversi WIB ke UTC:**
```
WIB 09:00 → UTC 02:00
WIB 12:00 → UTC 05:00
WIB 15:00 → UTC 08:00
WIB 18:00 → UTC 11:00
WIB 21:00 → UTC 14:00
```

---

### 4️⃣ **Threshold Configuration**

```env
# Volume minimum untuk trigger alert (dalam USD)
ALERT_VOLUME_THRESHOLD_USD="50000"

# Volume untuk status HOT (dalam USD)
HOT_VOLUME_THRESHOLD_USD="50000"

# Usia token untuk label NEW (dalam jam)
NEW_AGE_HOURS="24"
```

---

## 🚀 Cara Apply Perubahan

Setelah edit `.env`:

```bash
# Restart backend untuk apply config baru
sudo supervisorctl restart backend

# Cek status
sudo supervisorctl status backend

# Lihat log scanner
tail -f /var/log/supervisor/backend.err.log | grep "Background scanner"
```

---

## 📋 Contoh Konfigurasi Lengkap

### **Setup 1: Alert Setiap 10 Menit**
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."
TELEGRAM_CHAT_ID="987654321"
SCANNER_PAUSED="false"
SCAN_INTERVAL_SECONDS="600"
CRON_SCHEDULE=""
ALERT_VOLUME_THRESHOLD_USD="100000"
```

### **Setup 2: Alert 3x Sehari (Pagi, Siang, Malam WIB)**
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."
TELEGRAM_CHAT_ID="987654321"
SCANNER_PAUSED="false"
SCAN_INTERVAL_SECONDS="300"
CRON_SCHEDULE="02:00,05:00,14:00"  # 09:00, 12:00, 21:00 WIB
ALERT_VOLUME_THRESHOLD_USD="50000"
```

### **Setup 3: Pause Sementara**
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."
TELEGRAM_CHAT_ID="987654321"
SCANNER_PAUSED="true"  # 🛑 Scanner tidak jalan
SCAN_INTERVAL_SECONDS="300"
CRON_SCHEDULE=""
```

---

## 🧪 Testing

### **Manual Test Alert**
Dari UI, klik tombol **"Send Test"** di Telegram Config dialog.

Atau via curl:
```bash
curl -X POST http://localhost:8001/api/telegram/test
```

### **Manual Scan & Alert**
```bash
curl -X POST http://localhost:8001/api/telegram/scan-and-alert
```

---

## 📊 Log Monitoring

```bash
# Lihat log background scanner
tail -f /var/log/supervisor/backend.err.log | grep "Background scanner\|Interval scan\|Cron trigger"

# Lihat semua backend logs
tail -f /var/log/supervisor/backend.out.log
```

**Log Messages:**
- `🤖 Background scanner started. PAUSED=False, INTERVAL=300s, CRON=disabled` → Scanner aktif (interval mode)
- `🤖 Background scanner started. PAUSED=False, INTERVAL=300s, CRON=09:00,15:00,21:00` → Scanner aktif (cron mode)
- `🔄 Interval scan triggered (every 300s)` → Scan via interval
- `⏰ Cron trigger at 09:00 UTC` → Scan via cron schedule
- `Scanner is PAUSED, skipping...` → Scanner di-pause

---

## ❓ FAQ

**Q: Telegram mengirim alert double/triple?**
A: Ada dedup mechanism 6 jam. Token yang sama tidak akan dikirim lagi dalam 6 jam terakhir.

**Q: Tidak ada alert muncul?**
A: Cek:
1. `SCANNER_PAUSED="false"`
2. `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` terisi
3. Ada token yang memenuhi threshold (`volume_24h_usd >= ALERT_VOLUME_THRESHOLD_USD` ATAU `status = HOT/HOT_NEW`)

**Q: Cron schedule tidak berjalan tepat waktu?**
A: Scanner cek setiap menit. Jika waktu match, akan trigger (dengan cooldown 1 jam).

**Q: Bisa pakai timezone lokal (WIB/WITA)?**
A: Tidak. Semua waktu harus UTC. Convert manual dari timezone lokal.

---

## 🔐 Security Note

**JANGAN commit** file `.env` ke git! Token Telegram adalah rahasia.
File `.gitignore` sudah include `.env` secara default.
