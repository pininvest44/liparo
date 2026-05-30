import os
import json
import requests
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import csv
import io

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# In-memory storage (use Redis/DB in production)
transactions = []
lock = threading.Lock()

# Liparo API configuration
LIPARO_BASE_URL = os.environ.get('LIPARO_BASE_URL', 'https://api.liparo.co.ke/v1')


def initiate_stk_push(phone, amount, shortcode, passkey, secret_key, reference):
    """Send STK push request to Liparo API"""
    url = f"{LIPARO_BASE_URL}/initiatestk"

    payload = {
        "secret_key": secret_key,
        "passkey": passkey,
        "shortcode": shortcode,
        "amount": int(amount),
        "phone": phone,
        "reference": reference
    }

    try:
        response = requests.post(url, json=payload, timeout=30)
        return response.json(), response.status_code
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "success": False}, 500


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/push-single', methods=['POST'])
def push_single():
    """Send STK push to a single number"""
    data = request.get_json()

    required = ['phone', 'amount', 'shortcode', 'passkey', 'secret_key']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    phone = data['phone'].strip()
    if not phone.startswith('254'):
        return jsonify({"success": False, "error": "Phone must start with 254 (e.g., 254712345678)"}), 400

    reference = data.get('reference', f"BULK-{datetime.now().strftime('%Y%m%d%H%M%S')}")

    result, status = initiate_stk_push(
        phone=phone,
        amount=data['amount'],
        shortcode=data['shortcode'],
        passkey=data['passkey'],
        secret_key=data['secret_key'],
        reference=reference
    )

    tx = {
        "id": len(transactions) + 1,
        "phone": phone,
        "amount": data['amount'],
        "reference": reference,
        "status": "success" if status == 200 and result.get('success') else "failed",
        "response": result,
        "timestamp": datetime.now().isoformat()
    }

    with lock:
        transactions.append(tx)

    return jsonify({"success": status == 200, "data": tx}), status


@app.route('/api/push-bulk', methods=['POST'])
def push_bulk():
    """Send STK push to multiple numbers"""
    data = request.get_json()

    required = ['phones', 'amount', 'shortcode', 'passkey', 'secret_key']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    phones = [p.strip() for p in data['phones'] if p.strip()]
    if not phones:
        return jsonify({"success": False, "error": "No valid phone numbers provided"}), 400

    results = []
    base_reference = data.get('reference', 'BULK')

    for idx, phone in enumerate(phones):
        if not phone.startswith('254'):
            tx = {
                "id": len(transactions) + 1,
                "phone": phone,
                "amount": data['amount'],
                "reference": f"{base_reference}-{idx+1}",
                "status": "failed",
                "response": {"error": "Invalid phone format (must start with 254)"},
                "timestamp": datetime.now().isoformat()
            }
            with lock:
                transactions.append(tx)
            results.append(tx)
            continue

        reference = f"{base_reference}-{idx+1}"
        result, status = initiate_stk_push(
            phone=phone,
            amount=data['amount'],
            shortcode=data['shortcode'],
            passkey=data['passkey'],
            secret_key=data['secret_key'],
            reference=reference
        )

        tx = {
            "id": len(transactions) + 1,
            "phone": phone,
            "amount": data['amount'],
            "reference": reference,
            "status": "success" if status == 200 and result.get('success') else "failed",
            "response": result,
            "timestamp": datetime.now().isoformat()
        }

        with lock:
            transactions.append(tx)
        results.append(tx)

    success_count = sum(1 for r in results if r['status'] == 'success')

    return jsonify({
        "success": True,
        "summary": {
            "total": len(phones),
            "successful": success_count,
            "failed": len(phones) - success_count
        },
        "results": results
    })


@app.route('/api/upload-csv', methods=['POST'])
def upload_csv():
    """Upload CSV with phone numbers"""
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("UTF-8"), newline=None)
        csv_reader = csv.reader(stream)
        phones = []
        for row in csv_reader:
            for cell in row:
                cell = cell.strip()
                if cell and cell.startswith('254'):
                    phones.append(cell)

        return jsonify({"success": True, "phones": phones, "count": len(phones)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


@app.route('/api/transactions')
def get_transactions():
    """Get all transactions"""
    with lock:
        return jsonify({"success": True, "transactions": transactions[::-1]})


@app.route('/api/clear', methods=['POST'])
def clear_transactions():
    """Clear transaction history"""
    with lock:
        transactions.clear()
    return jsonify({"success": True, "message": "Transaction history cleared"})


@app.route('/api/export')
def export_csv():
    """Export transactions as CSV"""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Phone', 'Amount', 'Reference', 'Status', 'Timestamp', 'Response'])

    with lock:
        for tx in transactions:
            writer.writerow([
                tx['id'],
                tx['phone'],
                tx['amount'],
                tx['reference'],
                tx['status'],
                tx['timestamp'],
                json.dumps(tx['response'])
            ])

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f"liparo_transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
