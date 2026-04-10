// Check if already configured
function checkIfConfigured() {
    const config = localStorage.getItem('streamFlowConfig');
    if (config) {
        window.location.href = 'index.html';
    }
}

// Toggle advanced settings
function toggleAdvanced() {
    const toggle = document.querySelector('.advanced-toggle');
    const section = document.getElementById('advancedSection');
    toggle.classList.toggle('active');
    section.classList.toggle('show');
}

// Show status message
function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = `status-message show ${type}`;
    
    if (type === 'error' || type === 'success') {
        setTimeout(() => {
            el.classList.remove('show');
        }, 4000);
    }
}

// Test Jackett connection (via backend to avoid CORS)
async function testJackett() {
    const ip = document.getElementById('jackettIp').value;
    const port = document.getElementById('jackettPort').value;
    const apiKey = document.getElementById('jackettKey').value;

    if (!apiKey || !ip || !port) {
        showStatus('jackettStatus', '⚠️ Please fill in all Jackett fields', 'error');
        return;
    }

    showStatus('jackettStatus', '🔍 Testing Jackett connection...', 'info');

    try {
        const backendUrl = document.getElementById('backendUrl').value || window.location.origin;
        const response = await fetch(`${backendUrl}/api/test-jackett`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jackett_ip: ip,
                jackett_port: port,
                jackett_api_key: apiKey
            }),
            signal: AbortSignal.timeout(10000)
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            showStatus('jackettStatus', '✅ Jackett connection successful!', 'success');
        } else {
            showStatus('jackettStatus', `❌ ${data.error || 'Jackett error'}`, 'error');
        }
    } catch (error) {
        showStatus('jackettStatus', `❌ Cannot connect to Jackett: ${error.message}`, 'error');
    }
}

// Save configuration
async function saveConfiguration(formData) {
    const config = {
        tmdb_api_key: formData.get('tmdb_api_key'),
        jackett_api_key: formData.get('jackett_api_key'),
        jackett_ip: formData.get('jackett_ip'),
        jackett_port: formData.get('jackett_port'),
        backend_url: formData.get('backend_url') || window.location.origin
    };

    // Save to localStorage
    localStorage.setItem('streamFlowConfig', JSON.stringify(config));

    // Send to backend to save in config.json
    try {
        const response = await fetch(`${config.backend_url}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            showStatus('statusMessage', '✅ Configuration saved successfully!', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('Could not save to backend, but config is saved locally:', error.message);
        // Even if backend fails, we have localStorage
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }
}

// Handle form submission
document.getElementById('setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    showStatus('statusMessage', '💾 Saving configuration...', 'info');

    const formData = new FormData(document.getElementById('setupForm'));
    await saveConfiguration(formData);

    submitBtn.disabled = false;
});

// Check on page load
window.addEventListener('DOMContentLoaded', checkIfConfigured);
