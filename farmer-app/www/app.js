// Configuration
const API_URL = 'https://api.zammunda.com';
const API_BASE = 'https://api.zammunda.com'; // For new endpoints
let currentFarmer = null;
let authToken = null;

// Get Capacitor Preferences plugin from global
const { Preferences } = window.Capacitor?.Plugins || {};

// Wait for Capacitor to be ready
async function initializeApp() {
    console.log('App initializing...');
    
    try {
        // Check for saved session
        const session = Preferences ? await Preferences.get({ key: 'farmer_session' }) : { value: null };
        
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
        }, 1000);
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showLogin();
    }
    
    setupEventListeners();
}

// Initialize app when both DOM and Capacitor are ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

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
    
    const loginBtn = e.target.querySelector('button[type="submit"]');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
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
            try {
                if (Preferences) {
                    await Preferences.set({
                        key: 'farmer_session',
                        value: JSON.stringify({ token: authToken, farmer: currentFarmer })
                    });
                }
            } catch (prefError) {
                console.warn('Could not save session:', prefError);
            }
            
            await loadFarmerData();
            showMainApp();
            showToast('Welcome back!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            showToast(errorData.message || 'Invalid phone number or PIN', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Connection error. Please check your internet.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            if (Preferences) {
                await Preferences.remove({ key: 'farmer_session' });
            }
        } catch (error) {
            console.warn('Could not clear session:', error);
        }
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
            const data = await statusResponse.json();
            // API returns { farmer: {...} }, extract the farmer object
            currentFarmer = data.farmer || data;
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
    
    try {
        // Home tab
        const welcomeName = document.getElementById('welcomeName');
        const welcomeDistrict = document.getElementById('welcomeDistrict');
        if (welcomeName) welcomeName.textContent = `Welcome, ${currentFarmer.name || 'Farmer'}!`;
        if (welcomeDistrict) welcomeDistrict.textContent = `${currentFarmer.district || 'Unknown'} - ${currentFarmer.epa || ''}`;
        
        // Stats
        const totalLand = document.getElementById('totalLand');
        const totalReceipts = document.getElementById('totalReceipts');
        const totalLoans = document.getElementById('totalLoans');
        if (totalLand) totalLand.textContent = currentFarmer.totalLand || '0';
        if (totalReceipts) totalReceipts.textContent = currentFarmer.receipts?.length || '0';
        if (totalLoans) totalLoans.textContent = currentFarmer.loans?.active || '0';
        
        // Profile tab
        const profileName = document.getElementById('profileName');
        const profilePhone = document.getElementById('profilePhone');
        const profileDistrict = document.getElementById('profileDistrict');
        const profileEpa = document.getElementById('profileEpa');
        const profileVillage = document.getElementById('profileVillage');
        const profileGender = document.getElementById('profileGender');
        const profileHousehold = document.getElementById('profileHousehold');
        const profileHouseholdType = document.getElementById('profileHouseholdType');
        
        if (profileName) profileName.textContent = currentFarmer.name || '--';
        if (profilePhone) profilePhone.textContent = currentFarmer.phone || '--';
        if (profileDistrict) profileDistrict.textContent = currentFarmer.district || '--';
        if (profileEpa) profileEpa.textContent = currentFarmer.epa || '--';
        if (profileVillage) profileVillage.textContent = currentFarmer.village || '--';
        if (profileGender) profileGender.textContent = currentFarmer.gender || '--';
        if (profileHousehold) profileHousehold.textContent = currentFarmer.household_size || '--';
        if (profileHouseholdType) profileHouseholdType.textContent = formatHouseholdType(currentFarmer.household_type);
        
        // Recent activity
        updateRecentActivity();
    } catch (error) {
        console.error('Error updating UI:', error);
    }
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
    console.log('Switching to tab:', tabName);
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('Tab activated:', tabName);
    } else {
        console.error('Tab not found:', `${tabName}Tab`);
    }
    
    // Load data for specific tabs
    if (tabName === 'receipts') {
        loadReceipts();
    } else if (tabName === 'market') {
        loadMarketPrices();
    } else if (tabName === 'farm') {
        console.log('Loading farm data...');
        loadParcels();
        loadSeasons();
        loadHousehold();
    } else if (tabName === 'production') {
        loadSeasons();
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

// ============================================
// FARM TAB FUNCTIONS
// ============================================

// Parcels Management
async function loadParcels() {
    console.log('Loading parcels...');
    try {
        if (!authToken) {
            console.error('No auth token available');
            showToast('Please login first', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/farmers/me/parcels`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('Parcels response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Parcels API error:', response.status, errorText);
            showToast(`Failed to load parcels: ${response.status}`, 'error');
            displayParcels([]);
            return;
        }
        
        const data = await response.json();
        console.log('Parcels data:', data);
        displayParcels(data.parcels || []);
    } catch (error) {
        console.error('Failed to load parcels:', error);
        showToast('Network error loading parcels', 'error');
        displayParcels([]);
    }
}

function displayParcels(parcels) {
    const container = document.getElementById('parcelsList');
    if (!parcels.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏞️</div><p>No land parcels added yet</p></div>';
        return;
    }
    
    container.innerHTML = parcels.map(p => `
        <div class="card-item">
            <div class="card-item-header">
                <span class="card-item-title">${p.parcel_name}</span>
                <span class="card-item-badge ${p.status === 'active' ? '' : 'inactive'}">${p.status || 'active'}</span>
            </div>
            <div class="card-item-details">
                <div>📐 Size: ${p.area_hectares} hectares</div>
                <div>🏷️ Ownership: ${p.ownership_type}</div>
                ${p.soil_type ? `<div>🌱 Soil: ${p.soil_type}</div>` : ''}
                ${p.water_source ? `<div>💧 Water: ${p.water_source}</div>` : ''}
            </div>
        </div>
    `).join('');
}

window.showAddParcel = function() {
    document.getElementById('addParcelModal').classList.add('show');
    document.getElementById('parcelName').value = '';
    document.getElementById('parcelSize').value = '';
    document.getElementById('parcelOwnership').value = '';
    document.getElementById('parcelSoilType').value = '';
    document.getElementById('parcelWaterSource').value = '';
    document.getElementById('gpsStatus').textContent = '';
};

window.closeAddParcel = function() {
    document.getElementById('addParcelModal').classList.remove('show');
};

let capturedGPS = null;
window.captureGPS = async function() {
    const statusEl = document.getElementById('gpsStatus');
    statusEl.textContent = '📍 Capturing GPS...';
    
    try {
        const { Geolocation } = window.Capacitor?.Plugins || {};
        if (!Geolocation) {
            statusEl.textContent = '❌ GPS not available';
            return;
        }
        
        const position = await Geolocation.getCurrentPosition();
        capturedGPS = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
        statusEl.textContent = `✅ GPS captured: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    } catch (error) {
        statusEl.textContent = '❌ Failed to capture GPS';
        console.error('GPS error:', error);
    }
};

document.getElementById('addParcelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        parcel_name: document.getElementById('parcelName').value,
        area_hectares: parseFloat(document.getElementById('parcelSize').value),
        ownership_type: document.getElementById('parcelOwnership').value,
        soil_type: document.getElementById('parcelSoilType').value,
        water_source: document.getElementById('parcelWaterSource').value,
        ...(capturedGPS && capturedGPS)
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/parcels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Parcel added successfully', 'success');
            closeAddParcel();
            loadParcels();
            capturedGPS = null;
        } else {
            showToast('❌ Failed to add parcel', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
        console.error('Add parcel error:', error);
    }
});

// Seasons Management
async function loadSeasons() {
    console.log('Loading seasons...');
    try {
        if (!authToken) {
            console.error('No auth token available');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('Seasons response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Seasons API error:', response.status, errorText);
            displaySeasons([]);
            populateSeasonSelect([]);
            return;
        }
        
        const data = await response.json();
        console.log('Seasons data:', data);
        displaySeasons(data.seasons || []);
        populateSeasonSelect(data.seasons || []);
    } catch (error) {
        console.error('Failed to load seasons:', error);
        displaySeasons([]);
        populateSeasonSelect([]);
    }
}

function displaySeasons(seasons) {
    const container = document.getElementById('seasonsList');
    if (!seasons.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌾</div><p>No production seasons yet</p></div>';
        return;
    }
    
    container.innerHTML = seasons.map(s => `
        <div class="card-item">
            <div class="card-item-header">
                <span class="card-item-title">${s.crop} - ${s.season_name}</span>
                <span class="card-item-badge ${s.status === 'active' ? '' : 'inactive'}">${s.status || 'active'}</span>
            </div>
            <div class="card-item-details">
                <div>📐 Area: ${s.area_hectares} hectares</div>
                ${s.variety ? `<div>🌱 Variety: ${s.variety}</div>` : ''}
                ${s.planting_date ? `<div>📅 Planted: ${new Date(s.planting_date).toLocaleDateString()}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function populateSeasonSelect(seasons) {
    const select = document.getElementById('activeSeasonSelect');
    select.innerHTML = '<option value="">-- Select a season --</option>' +
        seasons.filter(s => s.status === 'active').map(s => 
            `<option value="${s.id}">${s.crop} - ${s.season_name}</option>`
        ).join('');
}

window.showAddSeason = async function() {
    // First load parcels to populate dropdown
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/parcels`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const select = document.getElementById('seasonParcel');
        select.innerHTML = '<option value="">Select parcel...</option>' +
            (data.parcels || []).map(p => `<option value="${p.id}">${p.parcel_name} (${p.area_hectares}ha)</option>`).join('');
    } catch (error) {
        console.error('Failed to load parcels:', error);
    }
    
    document.getElementById('addSeasonModal').classList.add('show');
    document.getElementById('seasonCrop').value = '';
    document.getElementById('seasonVariety').value = '';
    document.getElementById('seasonArea').value = '';
};

window.closeAddSeason = function() {
    document.getElementById('addSeasonModal').classList.remove('show');
};

document.getElementById('addSeasonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        parcel_id: document.getElementById('seasonParcel').value,
        crop: document.getElementById('seasonCrop').value,
        variety: document.getElementById('seasonVariety').value,
        area_hectares: parseFloat(document.getElementById('seasonArea').value),
        season_name: document.getElementById('seasonName').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Season started successfully', 'success');
            closeAddSeason();
            loadSeasons();
        } else {
            showToast('❌ Failed to start season', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
        console.error('Add season error:', error);
    }
});

// Household Management
async function loadHousehold() {
    console.log('Loading household...');
    try {
        if (!authToken) {
            console.error('No auth token available');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/farmers/me/household`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        console.log('Household response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Household API error:', response.status, errorText);
            displayHousehold([]);
            return;
        }
        
        const data = await response.json();
        console.log('Household data:', data);
        displayHousehold(data.members || []);
    } catch (error) {
        console.error('Failed to load household:', error);
        displayHousehold([]);
    }
}

function displayHousehold(members) {
    const container = document.getElementById('householdList');
    if (!members.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👨‍👩‍👧‍👦</div><p>No household members added yet</p></div>';
        return;
    }
    
    container.innerHTML = members.map(m => `
        <div class="card-item">
            <div class="card-item-header">
                <span class="card-item-title">${m.name}</span>
            </div>
            <div class="card-item-details">
                <div>🔗 Relationship: ${m.relationship}</div>
                ${m.age ? `<div>🎂 Age: ${m.age}</div>` : ''}
                ${m.gender ? `<div>👤 Gender: ${m.gender}</div>` : ''}
                ${m.involved_in_farming ? '<div>🌾 Involved in farming</div>' : ''}
            </div>
        </div>
    `).join('');
}

window.showAddMember = function() {
    document.getElementById('addMemberModal').classList.add('show');
    document.getElementById('memberName').value = '';
    document.getElementById('memberRelationship').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberGender').value = '';
    document.getElementById('memberFarming').checked = false;
};

window.closeAddMember = function() {
    document.getElementById('addMemberModal').classList.remove('show');
};

document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('memberName').value,
        relationship: document.getElementById('memberRelationship').value,
        age: parseInt(document.getElementById('memberAge').value) || null,
        gender: document.getElementById('memberGender').value || null,
        involved_in_farming: document.getElementById('memberFarming').checked
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/household`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Member added successfully', 'success');
            closeAddMember();
            loadHousehold();
        } else {
            showToast('❌ Failed to add member', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
        console.error('Add member error:', error);
    }
});

// ============================================
// PRODUCTION TAB FUNCTIONS
// ============================================

let currentSeasonId = null;

window.loadSeasonDetails = async function() {
    currentSeasonId = document.getElementById('activeSeasonSelect').value;
    
    if (!currentSeasonId) {
        document.getElementById('seasonDetailsContainer').style.display = 'none';
        return;
    }
    
    document.getElementById('seasonDetailsContainer').style.display = 'block';
    await loadActivities();
    await loadMonitoring();
    await loadCosts();
    updateSeasonStats();
};

async function updateSeasonStats() {
    // Calculate days since planting
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const season = (data.seasons || []).find(s => s.id === currentSeasonId);
        
        if (season && season.planting_date) {
            const days = Math.floor((new Date() - new Date(season.planting_date)) / (1000 * 60 * 60 * 24));
            document.getElementById('daysSincePlanting').textContent = days;
        } else {
            document.getElementById('daysSincePlanting').textContent = '--';
        }
    } catch (error) {
        console.error('Failed to update stats:', error);
    }
}

// Sub-tabs switching
document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sub-tab-pane').forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(subtab + 'Subtab').classList.add('active');
    });
});

// Activities
async function loadActivities() {
    if (!currentSeasonId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/activities`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        displayActivities(data.activities || []);
        document.getElementById('seasonActivities').textContent = (data.activities || []).length;
    } catch (error) {
        console.error('Failed to load activities:', error);
    }
}

function displayActivities(activities) {
    const container = document.getElementById('activitiesList');
    if (!activities.length) {
        container.innerHTML = '<div class="empty-state"><p>No activities logged yet</p></div>';
        return;
    }
    
    container.innerHTML = activities.map(a => `
        <div class="timeline-item">
            <div class="timeline-date">${new Date(a.activity_date).toLocaleDateString()}</div>
            <div class="timeline-content">
                <div class="timeline-title">${formatActivityType(a.activity_type)}</div>
                ${a.description ? `<div class="timeline-description">${a.description}</div>` : ''}
                <div class="timeline-meta">
                    ${a.labor_hours ? `<span>⏱️ ${a.labor_hours}h</span>` : ''}
                    ${a.cost_mwk ? `<span>💰 MWK ${a.cost_mwk.toLocaleString()}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function formatActivityType(type) {
    const types = {
        'land_prep': 'Land Preparation',
        'planting': 'Planting',
        'weeding': 'Weeding',
        'fertilizing': 'Fertilizing',
        'spraying': 'Spraying',
        'irrigation': 'Irrigation',
        'monitoring': 'Monitoring',
        'harvesting': 'Harvesting'
    };
    return types[type] || type;
}

window.showLogActivity = function() {
    document.getElementById('logActivityModal').classList.add('show');
    document.getElementById('activityDate').value = new Date().toISOString().split('T')[0];
};

window.closeLogActivity = function() {
    document.getElementById('logActivityModal').classList.remove('show');
};

document.getElementById('logActivityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        activity_date: document.getElementById('activityDate').value,
        activity_type: document.getElementById('activityType').value,
        description: document.getElementById('activityDescription').value || null,
        labor_hours: parseFloat(document.getElementById('activityLaborHours').value) || null,
        cost_mwk: parseFloat(document.getElementById('activityCost').value) || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Activity logged', 'success');
            closeLogActivity();
            loadActivities();
            loadCosts();
        } else {
            showToast('❌ Failed to log activity', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
    }
});

// Monitoring
async function loadMonitoring() {
    if (!currentSeasonId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/monitoring`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        displayMonitoring(data.records || []);
    } catch (error) {
        console.error('Failed to load monitoring:', error);
    }
}

function displayMonitoring(records) {
    const container = document.getElementById('monitoringList');
    if (!records.length) {
        container.innerHTML = '<div class="empty-state"><p>No monitoring records yet</p></div>';
        return;
    }
    
    container.innerHTML = records.map(r => `
        <div class="timeline-item">
            <div class="timeline-date">${new Date(r.observation_date).toLocaleDateString()}</div>
            <div class="timeline-content">
                <div class="timeline-title">${r.crop_stage || 'Observation'}</div>
                ${r.crop_health ? `<div class="timeline-description">Health: ${r.crop_health}</div>` : ''}
                ${r.pests_observed ? `<div class="timeline-description">🐛 Pests: ${r.pests_observed}</div>` : ''}
                ${r.diseases_observed ? `<div class="timeline-description">🦠 Diseases: ${r.diseases_observed}</div>` : ''}
                ${r.notes ? `<div class="timeline-description">${r.notes}</div>` : ''}
            </div>
        </div>
    `).join('');
}

window.showRecordMonitoring = function() {
    document.getElementById('recordMonitoringModal').classList.add('show');
    document.getElementById('monitoringDate').value = new Date().toISOString().split('T')[0];
};

window.closeRecordMonitoring = function() {
    document.getElementById('recordMonitoringModal').classList.remove('show');
};

document.getElementById('recordMonitoringForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        observation_date: document.getElementById('monitoringDate').value,
        crop_stage: document.getElementById('monitoringStage').value || null,
        crop_health: document.getElementById('monitoringHealth').value || null,
        pests_observed: document.getElementById('monitoringPests').value || null,
        diseases_observed: document.getElementById('monitoringDiseases').value || null,
        action_taken: document.getElementById('monitoringAction').value || null,
        notes: document.getElementById('monitoringNotes').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/monitoring`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Monitoring recorded', 'success');
            closeRecordMonitoring();
            loadMonitoring();
        } else {
            showToast('❌ Failed to record monitoring', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
    }
});

// Costs
async function loadCosts() {
    if (!currentSeasonId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/costs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        displayCostSummary(data.summary || {});
        displayCosts(data.costs || []);
    } catch (error) {
        console.error('Failed to load costs:', error);
    }
}

function displayCostSummary(summary) {
    const container = document.getElementById('costSummary');
    container.innerHTML = `
        <div class="cost-summary-row">
            <span class="cost-summary-label">Land Prep</span>
            <span class="cost-summary-value">MWK ${(summary.land_preparation || 0).toLocaleString()}</span>
        </div>
        <div class="cost-summary-row">
            <span class="cost-summary-label">Seeds</span>
            <span class="cost-summary-value">MWK ${(summary.seeds || 0).toLocaleString()}</span>
        </div>
        <div class="cost-summary-row">
            <span class="cost-summary-label">Fertilizers</span>
            <span class="cost-summary-value">MWK ${(summary.fertilizers || 0).toLocaleString()}</span>
        </div>
        <div class="cost-summary-row">
            <span class="cost-summary-label">Labor</span>
            <span class="cost-summary-value">MWK ${(summary.labor || 0).toLocaleString()}</span>
        </div>
        <div class="cost-summary-row cost-summary-total">
            <span class="cost-summary-label">Total Costs</span>
            <span class="cost-summary-value">MWK ${(summary.total || 0).toLocaleString()}</span>
        </div>
    `;
    document.getElementById('seasonTotalCosts').textContent = `MWK ${(summary.total || 0).toLocaleString()}`;
}

function displayCosts(costs) {
    const container = document.getElementById('costsList');
    if (!costs.length) {
        container.innerHTML = '<div class="empty-state"><p>No costs recorded yet</p></div>';
        return;
    }
    
    container.innerHTML = costs.map(c => `
        <div class="timeline-item">
            <div class="timeline-date">${new Date(c.cost_date).toLocaleDateString()}</div>
            <div class="timeline-content">
                <div class="timeline-title">${c.description}</div>
                <div class="timeline-description">Category: ${c.category_name}</div>
                <div class="timeline-meta">
                    <span>💰 MWK ${c.amount.toLocaleString()}</span>
                    ${c.payment_method ? `<span>💳 ${c.payment_method}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

window.showAddCost = function() {
    document.getElementById('addCostModal').classList.add('show');
    document.getElementById('costDate').value = new Date().toISOString().split('T')[0];
};

window.closeAddCost = function() {
    document.getElementById('addCostModal').classList.remove('show');
};

document.getElementById('addCostForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        cost_date: document.getElementById('costDate').value,
        cost_category_id: document.getElementById('costCategory').value,
        description: document.getElementById('costDescription').value,
        amount: parseFloat(document.getElementById('costAmount').value),
        payment_method: document.getElementById('costPayment').value || null,
        production_stage: document.getElementById('costStage').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${currentSeasonId}/costs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast('✅ Cost recorded', 'success');
            closeAddCost();
            loadCosts();
        } else {
            showToast('❌ Failed to record cost', 'error');
        }
    } catch (error) {
        showToast('❌ Network error', 'error');
    }
});


// Export for HTML onclick handlers
window.switchTab = switchTab;
window.showEditProfile = showEditProfile;
window.closeEditProfile = closeEditProfile;
window.askAdvisor = askAdvisor;
window.sendMessage = sendMessage;
