// ===== State =====
let currentPhones = [];
let isProcessing = false;

// ===== DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    refreshTransactions();

    // Auto-count phone numbers
    document.getElementById('phone_numbers').addEventListener('input', updatePhoneCount);
});

// ===== Tab Switching =====
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById(tab + '-tab').classList.add('active');
}

// ===== Visibility Toggle =====
function toggleVisibility(id) {
    const input = document.getElementById(id);
    const btn = event.target.closest('.toggle-visibility');
    const icon = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ===== Phone Count =====
function updatePhoneCount() {
    const text = document.getElementById('phone_numbers').value;
    const phones = text.split('\n').filter(p => p.trim().startsWith('254'));
    document.getElementById('phone-count').textContent = `${phones.length} number${phones.length !== 1 ? 's' : ''}`;
}

function clearNumbers() {
    document.getElementById('phone_numbers').value = '';
    updatePhoneCount();
}

// ===== CSV Upload =====
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) processCSV(files[0]);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) processCSV(file);
}

function processCSV(file) {
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload-csv', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            currentPhones = data.phones;
            document.getElementById('csv-preview').classList.remove('hidden');
            document.getElementById('csv-count').textContent = `${data.count} numbers found`;
            showToast('success', 'CSV Loaded', `${data.count} phone numbers extracted`);
        } else {
            showToast('error', 'Upload Failed', data.error);
        }
    })
    .catch(err => showToast('error', 'Error', err.message));
}

// ===== Get Credentials =====
function getCredentials() {
    return {
        secret_key: document.getElementById('secret_key').value.trim(),
        passkey: document.getElementById('passkey').value.trim(),
        shortcode: document.getElementById('shortcode').value.trim(),
        amount: document.getElementById('amount').value.trim(),
        reference: document.getElementById('reference').value.trim() || 'BULK'
    };
}

function validateCredentials(creds) {
    const missing = [];
    if (!creds.secret_key) missing.push('Secret Key');
    if (!creds.passkey) missing.push('Passkey');
    if (!creds.shortcode) missing.push('Shortcode');
    if (!creds.amount) missing.push('Amount');
    return missing;
}

// ===== Send Bulk Push =====
function sendBulkPush() {
    if (isProcessing) return;

    const creds = getCredentials();
    const missing = validateCredentials(creds);
    if (missing.length) {
        showToast('error', 'Missing Fields', missing.join(', '));
        return;
    }

    // Get phones based on active tab
    const activeTab = document.querySelector('.tab-content.active').id;
    let phones = [];

    if (activeTab === 'manual-tab') {
        const text = document.getElementById('phone_numbers').value;
        phones = text.split('\n').map(p => p.trim()).filter(p => p);
    } else {
        phones = currentPhones;
    }

    if (!phones.length) {
        showToast('error', 'No Recipients', 'Please enter or upload phone numbers');
        return;
    }

    isProcessing = true;
    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    // Show progress
    document.getElementById('progress-container').classList.remove('hidden');
    updateProgress(0, phones.length);

    fetch('/api/push-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...creds,
            phones: phones
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            updateProgress(phones.length, phones.length);
            showToast('success', 'Batch Complete', 
                `${data.summary.successful} sent, ${data.summary.failed} failed`);
            updateSummary(data.summary);
            refreshTransactions();
        } else {
            showToast('error', 'Failed', data.error);
        }
    })
    .catch(err => showToast('error', 'Error', err.message))
    .finally(() => {
        isProcessing = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send STK Push';
        setTimeout(() => {
            document.getElementById('progress-container').classList.add('hidden');
        }, 2000);
    });
}

// ===== Test Single =====
function testSingle() {
    const creds = getCredentials();
    const missing = validateCredentials(creds);
    if (missing.length) {
        showToast('error', 'Missing Fields', missing.join(', '));
        return;
    }

    const text = document.getElementById('phone_numbers').value;
    const phones = text.split('\n').map(p => p.trim()).filter(p => p);

    if (!phones.length) {
        showToast('error', 'No Phone', 'Enter at least one phone number');
        return;
    }

    const phone = phones[0];

    fetch('/api/push-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...creds,
            phone: phone
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'Test Sent', `STK push sent to ${phone}`);
            refreshTransactions();
        } else {
            showToast('error', 'Test Failed', data.error || data.data?.response?.error || 'Unknown error');
        }
    })
    .catch(err => showToast('error', 'Error', err.message));
}

// ===== Progress =====
function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    document.getElementById('progress-text').textContent = `Processing ${current} of ${total}...`;
    document.getElementById('progress-percent').textContent = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

// ===== Summary =====
function updateSummary(summary) {
    document.getElementById('total-count').textContent = summary.total;
    document.getElementById('success-count').textContent = summary.successful;
    document.getElementById('failed-count').textContent = summary.failed;
}

// ===== Refresh Transactions =====
function refreshTransactions() {
    fetch('/api/transactions')
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            renderTransactions(data.transactions);
            // Update summary from transactions
            const total = data.transactions.length;
            const success = data.transactions.filter(t => t.status === 'success').length;
            document.getElementById('total-count').textContent = total;
            document.getElementById('success-count').textContent = success;
            document.getElementById('failed-count').textContent = total - success;
        }
    })
    .catch(err => console.error('Refresh failed:', err));
}

// ===== Render Transactions =====
function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');

    if (!transactions.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No transactions yet</p>
                <span>Send your first STK push to see results here</span>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => `
        <div class="transaction-item">
            <div class="tx-status ${tx.status}">
                <i class="fas fa-${tx.status === 'success' ? 'check' : 'times'}"></i>
            </div>
            <div class="tx-info">
                <div class="tx-phone">${tx.phone}</div>
                <div class="tx-meta">${tx.reference} &middot; ${formatTime(tx.timestamp)}</div>
            </div>
            <div>
                <div class="tx-amount">KES ${tx.amount}</div>
                <div class="tx-time">${tx.status}</div>
            </div>
        </div>
    `).join('');
}

function formatTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

// ===== Export CSV =====
function exportCSV() {
    window.location.href = '/api/export';
    showToast('success', 'Export Started', 'Downloading transactions...');
}

// ===== Clear History =====
function clearHistory() {
    if (!confirm('Clear all transaction history?')) return;

    fetch('/api/clear', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToast('success', 'Cleared', 'Transaction history cleared');
            refreshTransactions();
        }
    });
}

// ===== Toast System =====
function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
