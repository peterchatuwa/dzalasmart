import { Preferences } from '@capacitor/preferences';

// Configuration
const API_URL = 'https://api.zammunda.com';
let currentFarmer = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initializing...');
    
    // Check for saved session
    const session = await Preferences.get({ key: 'farmer_session' });
    
    setTimeout(async () => {
        hideLoading();
        
        if (session.value) {
            try {
                const sessionData = JSON.parse(session.value);
                authToken = sessionData.token;
                await loadFarmerData();
                showMainApp();
            } catch (error) {
                console.error('Session restore failed:', error);
                showLogin();
            }
        } else {
            showLogin();
        }
    }, 2000);
    
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Edit profile form
    document.getElementById('editProfileForm').addEventListener('submit', handleProfileUpdate);
    
    // Chat input
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const phone = document.getElementById('loginPhone').value;
    const pin = document.getElementById('loginPin').value;
    
    try {
        const response = await fetch(`${API_URL}/api/farmers/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, pin })
        });
        
        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            currentFarmer = data.farmer;
            
            // Save session
            await Preferences.set({
                key: 'farmer_session',
                value: JSON.stringify({ token: authToken, farmer: currentFarmer })
            });
            
            await loadFarmerData();
            showMainApp();
            showToast('Welcome back!', 'success');
        } else {
            showToast('Invalid phone number or PIN', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection error. Please try again.', 'error');
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        await Preferences.remove({ key: 'farmer_session' });
        authToken = null;
        currentFarmer = null;
        showLogin();
        showToast('Logged out successfully');
    }
}

// Load Farmer Data
async function loadFarmerData() {
    try {
        // Get farmer status
        const statusResponse = await fetch(`${API_URL}/api/farmers/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (statusResponse.ok) {
            currentFarmer = await statusResponse.json();
            updateUI();
        }
        
        // Load receipts
        await loadReceipts();
        
        // Load market prices
        await loadMarketPrices();
        
    } catch (error) {
        console.error('Error loading farmer data:', error);
    }
}

function updateUI() {
    if (!currentFarmer) return;
    
    // Home tab
    document.getElementById('welcomeName').textContent = `Welcome, ${currentFarmer.name}!`;
    document.getElementById('welcomeDistrict').textContent = `${currentFarmer.district} - ${currentFarmer.epa || ''}`;
    
    // Stats
    document.getElementById('totalLand').textContent = currentFarmer.totalLand || '0';
    document.getElementById('totalReceipts').textContent = currentFarmer.receipts?.length || '0';
    document.getElementById('totalLoans').textContent = currentFarmer.loans?.active || '0';
    
    // Profile tab
    document.getElementById('profileName').textContent = currentFarmer.name;
    document.getElementById('profilePhone').textContent = currentFarmer.phone;
    document.getElementById('profileDistrict').textContent = currentFarmer.district || '--';
    document.getElementById('profileEpa').textContent = currentFarmer.epa || '--';
    document.getElementById('profileVillage').textContent = currentFarmer.village || '--';
    document.getElementById('profileGender').textContent = currentFarmer.gender || '--';
    document.getElementById('profileHousehold').textContent = currentFarmer.household_size || '--';
    document.getElementById('profileHouseholdType').textContent = formatHouseholdType(currentFarmer.household_type);
    
    // Recent activity
    updateRecentActivity();
}

async function loadReceipts() {
    try {
        const response = await fetch(`${API_URL}/api/farmers/me/receipts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const receipts = await response.json();
            displayReceipts(receipts);
        }
    } catch (error) {
        console.error('Error loading receipts:', error);
    }
}

function displayReceipts(receipts) {
    const container = document.getElementById('receiptsList');
    
    if (!receipts || receipts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📄</div>
                <p>No warehouse receipts yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = receipts.map(receipt => `
        <div class="receipt-card">
            <div class="receipt-header">
                <span class="receipt-crop">🌾 ${receipt.crop}</span>
                <span class="receipt-weight">${receipt.weight_kg} kg</span>
            </div>
            <div class="receipt-details">
                <p>Moisture: ${receipt.moisture_pct}%</p>
                <p>Price/kg: MWK ${receipt.price_per_kg}</p>
            </div>
            <div class="receipt-footer">
                <span>Receipt: #${receipt.code}</span>
                <span class="receipt-value">MWK ${receipt.asset_value.toLocaleString()}</span>
            </div>
        </div>
    `).join('');
    
    // Display loans
    const loans = receipts.filter(r => r.loan_disbursed > 0);
    const loansContainer = document.getElementById('loansList');
    
    if (loans.length === 0) {
        loansContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💰</div>
                <p>No active loans</p>
            </div>
        `;
    } else {
        loansContainer.innerHTML = loans.map(loan => `
            <div class="loan-card">
                <div class="loan-header">
                    <div>
                        <div class="receipt-crop">Loan</div>
                        <small>Receipt #${loan.code}</small>
                    </div>
                    <span class="loan-status status-disbursed">Disbursed</span>
                </div>
                <div class="receipt-footer">
                    <span>Amount</span>
                    <span class="receipt-value">MWK ${loan.loan_disbursed.toLocaleString()}</span>
                </div>
            </div>
        `).join('');
    }
}

async function loadMarketPrices() {
    try {
        const response = await fetch(`${API_URL}/api/farmers/market`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayMarketPrices(data);
        }
    } catch (error) {
        console.error('Error loading market prices:', error);
    }
}

function displayMarketPrices(data) {
    const pricesContainer = document.getElementById('marketPrices');
    const floorsContainer = document.getElementById('priceFloors');
    
    if (data.prices && data.prices.length > 0) {
        pricesContainer.innerHTML = data.prices.map(price => `
            <div class="price-card">
                <div>
                    <div class="price-crop">${price.crop}</div>
                    <small style="color: #666;">Current market price</small>
                </div>
                <div class="price-amount">MWK ${price.price}</div>
            </div>
        `).join('');
    } else {
        pricesContainer.innerHTML = `<div class="empty-state"><p>No market prices available</p></div>`;
    }
    
    if (data.floors && data.floors.length > 0) {
        floorsContainer.innerHTML = data.floors.map(floor => `
            <div class="price-card">
                <div>
                    <div class="price-crop">${floor.crop}</div>
                    <small style="color: #666;">Government floor price</small>
                </div>
                <div class="price-amount">MWK ${floor.floor_price}</div>
            </div>
        `).join('');
    } else {
        floorsContainer.innerHTML = `<div class="empty-state"><p>No floor prices set</p></div>`;
    }
}

// Profile Management
function showEditProfile() {
    const modal = document.getElementById('editProfileModal');
    
    // Pre-fill form
    document.getElementById('editVillage').value = currentFarmer.village || '';
    document.getElementById('editGender').value = currentFarmer.gender || '';
    document.getElementById('editDob').value = currentFarmer.date_of_birth ? new Date(currentFarmer.date_of_birth).toISOString().split('T')[0] : '';
    document.getElementById('editHouseholdSize').value = currentFarmer.household_size || '';
    document.getElementById('editHouseholdType').value = currentFarmer.household_type || '';
    document.getElementById('editLivestock').value = currentFarmer.livestock || '';
    
    modal.style.display = 'block';
}

function closeEditProfile() {
    document.getElementById('editProfileModal').style.display = 'none';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const updates = {
        village: document.getElementById('editVillage').value,
        gender: document.getElementById('editGender').value,
        dateOfBirth: document.getElementById('editDob').value,
        householdSize: parseInt(document.getElementById('editHouseholdSize').value),
        householdType: document.getElementById('editHouseholdType').value,
        livestock: document.getElementById('editLivestock').value
    };
    
    try {
        const response = await fetch(`${API_URL}/api/farmers/me`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (response.ok) {
            showToast('Profile updated successfully!', 'success');
            closeEditProfile();
            await loadFarmerData();
        } else {
            showToast('Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showToast('Connection error', 'error');
    }
}

// Advisor Chat
async function askAdvisor(topic) {
    const questions = {
        'weather': 'What is the weather forecast for farming?',
        'fertilizer': 'What fertilizer should I use for my crops?',
        'irrigation': 'How can I improve my irrigation?',
        'pests': 'How do I deal with pests?',
        'storage': 'What are the best storage practices?',
        'market': 'When is the best time to sell my crops?'
    };
    
    document.getElementById('chatInput').value = questions[topic] || '';
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    try {
        const response = await fetch(`${API_URL}/api/farmers/advisor`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: message })
        });
        
        if (response.ok) {
            const data = await response.json();
            addChatMessage(data.advice, 'advisor');
        } else {
            addChatMessage('Sorry, I could not process your question. Please try again.', 'advisor');
        }
    } catch (error) {
        console.error('Advisor error:', error);
        addChatMessage('Connection error. Please check your internet.', 'advisor');
    }
}

function addChatMessage(text, sender) {
    const container = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message chat-${sender}`;
    messageDiv.textContent = text;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// UI Helpers
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Load data for specific tabs
    if (tabName === 'receipts') {
        loadReceipts();
    } else if (tabName === 'market') {
        loadMarketPrices();
    }
}

function updateRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    // Mock recent activity - in real app, this would come from API
    container.innerHTML = `
        <div class="activity-item">
            <div class="activity-title">📄 Warehouse receipt created</div>
            <div class="activity-time">2 days ago</div>
        </div>
        <div class="activity-item">
            <div class="activity-title">💰 Loan disbursed</div>
            <div class="activity-time">3 days ago</div>
        </div>
        <div class="activity-item">
            <div class="activity-title">👤 Profile updated</div>
            <div class="activity-time">1 week ago</div>
        </div>
    `;
}

function formatHouseholdType(type) {
    const types = {
        'single': 'Single',
        'married_no_children': 'Married (No Children)',
        'married_with_children': 'Married (With Children)',
        'single_parent': 'Single Parent',
        'extended_family': 'Extended Family'
    };
    return types[type] || type || '--';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

// Export for HTML onclick handlers
window.switchTab = switchTab;
window.showEditProfile = showEditProfile;
window.closeEditProfile = closeEditProfile;
window.askAdvisor = askAdvisor;
window.sendMessage = sendMessage;
