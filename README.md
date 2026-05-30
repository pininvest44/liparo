# Liparo Bulk STK Push Bot

A web application for sending bulk M-Pesa STK Push payment requests via the Liparo API. Built with Flask and designed for easy deployment on Render.

![Interface Preview](https://via.placeholder.com/800x400?text=Liparo+Bulk+STK+Push)

## Features

- **Single & Bulk STK Push** — Send payment requests to one or hundreds of numbers
- **Manual Entry** — Paste phone numbers directly (one per line)
- **CSV Upload** — Drag & drop CSV files with phone numbers
- **Live Results Dashboard** — Track success/failure in real-time
- **Export to CSV** — Download transaction history
- **Secure Credential Input** — Password fields with toggle visibility
- **Responsive Design** — Works on desktop and mobile

## Quick Start (Local)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/liparo-bulk-stk.git
cd liparo-bulk-stk

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run locally
python app.py
```

Open http://localhost:5000 in your browser.

## Deploy to Render (Free)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/liparo-bulk-stk.git
git push -u origin main
```

### Step 2: Create Render Account

1. Go to [render.com](https://render.com) and sign up (free, no credit card)
2. Connect your GitHub account when prompted

### Step 3: Create Web Service

1. Click **New +** → **Web Service**
2. Find and select your `liparo-bulk-stk` repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `liparo-bulk-stk` (or your choice) |
| **Region** | `Oregon (US West)` or closest to you |
| **Branch** | `main` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn app:app` |
| **Instance Type** | `Free` |

4. Click **Create Web Service**

Render will build and deploy your app. In ~2 minutes, you\'ll get a live URL like `https://liparo-bulk-stk.onrender.com`.

### Step 4: Set Environment Variables (Optional but Recommended)

In your Render dashboard:
1. Go to your service → **Environment** tab
2. Add:

| Key | Value | Purpose |
|-----|-------|---------|
| `SECRET_KEY` | A random string (generate at [random.org](https://random.org)) | Flask session security |
| `LIPARO_BASE_URL` | `https://api.liparo.co.ke/v1` | Liparo API base URL |

3. Click **Save Changes** — Render will redeploy automatically

> **Note:** Free instances "spin down" after 15 min of inactivity and take ~60s to wake up. Upgrade to Starter ($7/mo) for always-on.

## Usage

1. **Enter Credentials** — Fill in your Liparo Secret Key, M-Pesa Passkey, and Shortcode
2. **Add Recipients** — Either paste numbers manually or upload a CSV
3. **Set Amount** — Enter the payment amount in KES
4. **Send** — Click "Send STK Push" and watch results appear in real-time

### Phone Number Format

Numbers must start with `254` (e.g., `254712345678`). The app validates this automatically.

### CSV Format

Any CSV file works — the app extracts all cells starting with `254`:

```csv
254712345678
254723456789
254734567890
```

Or with headers:
```csv
name,phone
John,254712345678
Jane,254723456789
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web interface |
| `/api/push-single` | POST | Send to one number |
| `/api/push-bulk` | POST | Send to multiple numbers |
| `/api/upload-csv` | POST | Upload CSV file |
| `/api/transactions` | GET | Get all transactions |
| `/api/export` | GET | Export transactions as CSV |
| `/api/clear` | POST | Clear transaction history |

## Security Notes

- **Never commit credentials** to Git — the app accepts them via the web interface
- **Use HTTPS** — Render provides this automatically
- **Set a strong SECRET_KEY** environment variable in production
- The app stores transactions in memory only (resets on restart). For persistence, add a database.

## Tech Stack

- **Backend:** Flask (Python)
- **Frontend:** Vanilla JS + CSS (no build step)
- **Server:** Gunicorn (production WSGI)
- **Hosting:** Render (free tier available)

## License

MIT
