# 📘 Webhook Feature Requirements Document (FRD)

## 🔍 Overview
This document outlines the features, functionality, and implementation details for the Webhook integration that will enable automated trade execution in the application. The webhook system is designed for compatibility with TradingView alerts, ensuring secure, flexible, and reliable trade execution.

---

## 🎯 Feature List
The webhook system includes the following core features:

### ✅ Core Trading Functionality
- Supports **BUY**, **SELL**, **CLOSE**, and **REVERSE** actions
- Supports **Market**, **Limit**, and **Stop** order types
- Flexible quantity handling with **Dynamic Position Sizing** based on ATR (Average True Range)
- Implements **Pyramiding** for scaling into strong trends
- Supports **Partial Profit Taking** for strategic exits
- Implements **Profit Locking** to dynamically adjust stop-loss levels

---

### ✅ Risk Management & Execution Control
- Supports **Stop Loss**, **Take Profit**, and **Trailing Stop Loss** orders
- Implements **Conditional Orders** that trigger only when specified price conditions are met
- Enables **Time-Based Exits** (e.g., End-of-Day close)
- Provides **Order Cancellation** via webhook commands

---

### ✅ Error Handling & Alerts
- Includes **Email** and **Telegram Alerts** for error notifications
- Provides **Order Status Tracking** for real-time trade confirmation
- Implements **Webhook Retry Logic** for improved reliability during network issues

---

### ✅ Security
- Features **IP Whitelisting** to restrict access to trusted IP addresses
- Implements **HMAC Signature Verification** to authenticate incoming webhook payloads

---

## 📋 Webhook Payload Examples

### 🔹 **Standard Trade Signal**
```json
{
    "action": "BUY",
    "ticker": "AAPL",
    "quantity": 10,
    "entry_price": 180.50,
    "stop_loss": 175.00,
    "take_profit": 190.00
}

🔹 Advanced Trade Signal with Risk Controls
json
Copy
Edit
{
    "action": "BUY",
    "ticker": "TSLA",
    "quantity": 5,
    "entry_price": 900,
    "stop_loss": 870,
    "take_profit": 950,
    "trailing_stop_percent": 2,
    "profit_lock": {
        "new_stop_price": 925
    },
    "atr_sizing": true,
    "risk_percent": 2
}

🔹 Order Cancellation Signal
json
Copy
Edit
{
    "cancel_order": "order_56789"
}
🔒 Security Details
IP Whitelisting — Only the following trusted IPs will be accepted:

52.89.214.238

34.212.75.30

HMAC Signature Verification requires TradingView alerts to include a signed payload header using the pre-shared key.

📧 Notification Channels
Email Alerts are sent via Gmail SMTP

Telegram Alerts use the Telegram Bot API for real-time error notifications

🔄 Retry Logic
Webhook retry logic follows an exponential backoff strategy:

Attempt 1 → Immediate retry

Attempt 2 → Retry after 5 seconds

Attempt 3 → Retry after 10 seconds

🔧 Tech Stack
Language: Python 3.x

Framework: Flask

Broker API: Alpaca Markets API

🚀 Deployment Recommendations
Host the webhook service on a reliable platform like AWS Lambda, Google Cloud Functions, or a dedicated VPS

Use ngrok or Cloudflare Tunnels for secure local testing

📂 Directory Structure
bash
Copy
Edit
/webhook_service
│
├── webhook.py              # Main webhook logic
├── config.py               # Configuration settings
├── alert_utils.py          # Email/Telegram alert functions
├── security.py             # IP Whitelisting & HMAC Verification
├── requirements.txt        # Python dependencies
├── README.md               # Developer instructions
└── .env                    # Secure environment variables

🚨 Important Notes
Ensure all API keys and credentials are securely stored in environment variables.

Recommended to use SSL encryption for secure webhook communication.

📧 Contact
For questions or issues, please contact the development team.

python
Copy
Edit

---

## 📂 **Step 2: Consolidated Webhook Library**
Here’s the full webhook code wrapped neatly into a modular and organized Python library.

### 🔧 **`webhook.py` - Main Webhook Logic**
```python
from flask import Flask, request, jsonify
import logging
from alert_utils import send_email_alert, send_telegram_alert
from security import verify_webhook
from trade_logic import handle_trade_signal, cancel_order
from status_tracker import get_order_status

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

@app.before_request
def security_check():
    return verify_webhook()

@app.route('/webhook', methods=['POST'])
def webhook():
    data = request.get_json()
    return handle_trade_signal(data)

@app.route('/webhook/cancel', methods=['POST'])
def cancel_webhook():
    data = request.get_json()
    order_id = data.get("order_id")
    return cancel_order(order_id)

@app.route('/webhook/status', methods=['POST'])
def status_webhook():
    data = request.get_json()
    order_id = data.get("order_id")
    return get_order_status(order_id)

@app.errorhandler(500)
def internal_error(e):
    error_message = f"🚨 CRITICAL ERROR 🚨\n{str(e)}"
    send_email_alert("Webhook Error", error_message)
    send_telegram_alert(error_message)
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

📄 requirements.txt
nginx
Copy
Edit
flask
requests
schedule

📄 .env Example
ini
Copy
Edit
API_KEY=YOUR_ALPACA_API_KEY
API_SECRET=YOUR_ALPACA_SECRET_KEY
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_email_password