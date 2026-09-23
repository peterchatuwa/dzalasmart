// Configuration
const API_URL = 'https://api.zammunda.com';
const API_BASE = 'https://api.zammunda.com'; // For new endpoints
let currentFarmer = null;
let authToken = null;
let selectedSeasonId = null;
let latestCare = null;

// Get Capacitor Preferences plugin from global
const { Preferences, Camera } = window.Capacitor?.Plugins || {};

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
            const tabName = e.currentTarget.dataset.tab;
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
        
        if (!selectedSeasonId && Preferences) {
            const stored = await Preferences.get({ key: 'active_season' });
            if (stored?.value) selectedSeasonId = stored.value;
        }
        await loadHomeSummary();
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
        if (totalLand) totalLand.textContent = homeSummary?.hectares ?? '0';
        if (totalReceipts) totalReceipts.textContent = homeSummary?.receipts ?? '0';
        if (totalLoans) totalLoans.textContent = homeSummary?.loans ?? '0';
        
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
        
        renderRecentActivity(homeSummary?.recent || []);
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

function mwk(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return `MWK ${Math.round(n).toLocaleString('en-US')}`;
}

async function loadMarketPrices() {
    try {
        const params = new URLSearchParams();
        if (selectedSeasonId) params.set('seasonId', selectedSeasonId);
        const response = await fetch(`${API_URL}/api/farmers/market?${params}`, {
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
    const quotes = data.quotes || [];
    if (!quotes.length) {
        pricesContainer.innerHTML = `<div class="empty-state"><p>No market prices available</p></div>`;
        return;
    }
    const place = data.warehouseHub ? `Nearest warehouse: ${data.warehouseHub}. ` : '';
    const source = data.live ? 'Live warehouse quote.' : 'Showing the reference price until a live quote is available.';
    pricesContainer.innerHTML = `<p class="price-line">${place}${source}</p>` + quotes.map((quote) => {
        const title = quote.parcelName ? `${quote.parcelName} · ${quote.crop}` : quote.crop;
        const today = quote.today
            ? `${quote.today.live ? 'Today' : 'Reference'}: ${mwk(quote.today.pricePerKg)}/kg · ${quote.today.source}${quote.today.place ? ` · ${quote.today.place}` : ''}`
            : 'Today: no warehouse quote';
        const floor = quote.floor ? `Floor: ${mwk(quote.floor.pricePerKg)}/kg` : 'Floor: not set';
        const plan = quote.plan
            ? `Plan: ${mwk(quote.plan.pricePerKg)}/kg on the district sheet. Break-even ${mwk(quote.plan.breakEvenPrice)}/kg.`
            : '';
        const field = quote.plan && quote.plan.marginForField != null
            ? `This field: gross margin about ${mwk(quote.plan.marginForField)}.`
            : '';
        return `
            <div class="price-card price-board">
                <div class="price-crop">${title}</div>
                <div class="price-line">${today}</div>
                <div class="price-line">${floor}</div>
                ${plan ? `<div class="price-line">${plan}</div>` : ''}
                ${field ? `<div class="price-line">${field}</div>` : ''}
            </div>
        `;
    }).join('');
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
            body: JSON.stringify({
                query: message,
                text: message,
                lang: 'en',
                seasonId: selectedSeasonId
            })
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

async function photographPlant() {
    if (!selectedSeasonId) {
        addChatMessage('Choose a field on the Farm tab first, then photograph the plant.', 'advisor');
        return;
    }
    if (!Camera?.getPhoto) {
        addChatMessage('The camera is available in the phone app.', 'advisor');
        return;
    }
    try {
        if (Camera.requestPermissions) {
            const perm = await Camera.requestPermissions({ permissions: ['camera'] });
            const camera = perm?.camera || perm?.photos;
            if (camera && camera !== 'granted' && camera !== 'limited') {
                addChatMessage('Allow the camera to photograph the plant.', 'advisor');
                return;
            }
        }
        const photo = await Camera.getPhoto({
            quality: 50,
            width: 1024,
            resultType: 'base64',
            source: 'CAMERA',
            correctOrientation: true
        });
        if (!photo?.base64String) {
            addChatMessage('The photo did not come through. Try again.', 'advisor');
            return;
        }
        addChatMessage('Plant photo sent for this field.', 'user');
        const response = await fetch(`${API_URL}/api/farmers/advisor/photo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: photo.base64String,
                seasonId: selectedSeasonId,
                lang: 'en'
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            addChatMessage(data.error || 'Could not read this plant photo.', 'advisor');
            return;
        }
        showPhotoAdvice(data);
    } catch (error) {
        console.error('Plant photo error:', error);
        addChatMessage(error.message || 'Could not open the camera.', 'advisor');
    }
}

function showPhotoAdvice(data) {
    addChatMessage(data.advice || data.reply, 'advisor');
    if (!data.choices?.length || !data.id) return;
    const container = document.getElementById('chatContainer');
    const wrap = document.createElement('div');
    wrap.className = 'advisor-topics';
    for (const choice of data.choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'topic-chip';
        button.textContent = choice.lookFor;
        button.addEventListener('click', () => confirmPlantSign(data.id, choice.name, wrap));
        wrap.appendChild(button);
    }
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

async function confirmPlantSign(reportId, sign, wrap) {
    if (wrap) wrap.remove();
    addChatMessage(sign, 'user');
    try {
        const response = await fetch(`${API_URL}/api/farmers/advisor/photo/${reportId}/sign`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sign, lang: 'en' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            addChatMessage(data.error || 'Could not match that sign.', 'advisor');
            return;
        }
        addChatMessage(data.advice || data.reply, 'advisor');
    } catch (error) {
        console.error('Plant sign error:', error);
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

function selectedField(data) {
    const rows = data?.growing || [];
    if (!rows.length) return null;
    return rows.find((row) => row.seasonId === selectedSeasonId) || rows[0];
}

function describeField(crop) {
    if (!crop) return 'Start a production season so advice follows the field you select.';
    const ha = Number.isFinite(Number(crop.hectares)) ? `, ${crop.hectares} ha` : '';
    return `${crop.crop} on ${crop.parcelName}${ha}, day ${crop.ageDays}. Advice and quantities follow this field.`;
}

async function loadAdvisorContext() {
    const contextEl = document.getElementById('advisorContext');
    if (!contextEl || !authToken) return;
    try {
        if (!latestCare) {
            const response = await fetch(`${API_BASE}/api/farmers/me/care`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (!response.ok) return;
            latestCare = await response.json();
            await restoreSelectedSeason(latestCare.growing || []);
        }
        contextEl.textContent = describeField(selectedField(latestCare));
    } catch (error) {
        console.warn('Could not load crop context:', error);
    }
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
        renderFarmProfile();
        loadParcels();
        loadSeasons();
        loadHousehold();
        loadDailyCare();
    } else if (tabName === 'advisor') {
        loadAdvisorContext();
    } else if (tabName === 'production') {
        loadSeasons();
    }
}

let homeSummary = null;

async function loadHomeSummary() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/home`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return;
        homeSummary = await response.json();
        updateUI();
    } catch (error) {
        console.warn('Could not load home summary:', error);
    }
}

function renderRecentActivity(items) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<div class="empty-state"><p>No farm activity yet. Start a season and land preparation will show on the Farm tab.</p></div>';
        return;
    }
    container.innerHTML = items.map((item) => `
        <div class="activity-item">
            <div class="activity-title">${escapeHtml(item.title || 'Activity')}</div>
            <div class="activity-time">${escapeHtml(item.when || '')}</div>
        </div>
    `).join('');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
    loadDailyCare();
}

// ============================================
// FARM TAB FUNCTIONS
// ============================================

function renderFarmProfile() {
    const nameEl = document.getElementById('farmFarmerName');
    const locationEl = document.getElementById('farmLocation');
    const soilEl = document.getElementById('farmSoil');
    if (!currentFarmer) return;

    if (nameEl) nameEl.textContent = currentFarmer.name || 'My Farm';
    const location = [currentFarmer.village, currentFarmer.epa, currentFarmer.district].filter(Boolean).join(' · ');
    if (locationEl) locationEl.textContent = location || 'Location not set';
    const soil = currentFarmer.soilType || currentFarmer.soil_type;
    const nutrients = currentFarmer.nutrientStatus || currentFarmer.nutrient_status;
    if (soilEl) soilEl.textContent = [soil, nutrients].filter(Boolean).join(' · ');
}

async function loadDailyCare() {
    const tasksEl = document.getElementById('careTasks');
    const forecastEl = document.getElementById('careForecast');
    if (!tasksEl || !authToken) return;
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/care`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
            tasksEl.innerHTML = '<div class="empty-state"><p>Farm checks are unavailable right now.</p></div>';
            return;
        }
        const data = await response.json();
        latestCare = data;
        await restoreSelectedSeason(data.growing || []);
        syncFieldSelect(data.growing || []);
        renderCare(data);
        scheduleCareNotifications(data);
        const contextEl = document.getElementById('advisorContext');
        if (contextEl) contextEl.textContent = describeField(selectedField(data));
    } catch (error) {
        console.error('Failed to load farm checks:', error);
        tasksEl.innerHTML = '<div class="empty-state"><p>Could not load today\'s farm checks.</p></div>';
    }
}

function guideLines(guide) {
    if (!guide) return '';
    return [guide.seed, guide.fieldInputs, guide.margin, guide.fieldMargin, guide.suppliers, guide.buyers]
        .filter(Boolean)
        .map((line) => `<div class="care-crop-clear">${line}</div>`)
        .join('');
}

async function restoreSelectedSeason(growing) {
    if (!selectedSeasonId && Preferences) {
        const stored = await Preferences.get({ key: 'active_season' });
        if (stored?.value) selectedSeasonId = stored.value;
    }
    if (growing.length && !growing.some((row) => row.seasonId === selectedSeasonId)) {
        selectedSeasonId = growing[0].seasonId;
    }
}

function syncFieldSelect(growing) {
    const select = document.getElementById('fieldSelect');
    if (!select) return;
    select.replaceChildren();
    if (!growing.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Start a season to choose a field';
        select.appendChild(option);
        return;
    }
    for (const row of growing) {
        const option = document.createElement('option');
        option.value = row.seasonId;
        const ha = Number.isFinite(Number(row.hectares)) ? ` · ${row.hectares} ha` : '';
        option.textContent = `${row.parcelName} · ${row.crop}${ha}`;
        select.appendChild(option);
    }
    select.value = selectedSeasonId || growing[0].seasonId;
}

document.getElementById('fieldSelect')?.addEventListener('change', async (event) => {
    selectedSeasonId = event.target.value || null;
    if (Preferences && selectedSeasonId) {
        await Preferences.set({ key: 'active_season', value: selectedSeasonId });
    }
    currentSeasonId = selectedSeasonId;
    const productionSelect = document.getElementById('activeSeasonSelect');
    if (productionSelect && [...productionSelect.options].some((option) => option.value === selectedSeasonId)) {
        productionSelect.value = selectedSeasonId;
    }
    if (latestCare) {
        renderCare(latestCare);
        const contextEl = document.getElementById('advisorContext');
        if (contextEl) contextEl.textContent = describeField(selectedField(latestCare));
    }
    loadMarketPrices();
});

function renderCare(data) {
    const forecastEl = document.getElementById('careForecast');
    const tasksEl = document.getElementById('careTasks');
    const forecast = (data.forecast || []).slice(0, 3).map((day) => {
        return `${day.day} ${Math.round(day.max)}° / ${Number(day.rain || 0).toFixed(0)} mm`;
    }).join(' · ');
    if (forecastEl) {
        forecastEl.textContent = forecast
            ? `${data.alertHeadline || 'Forecast'}. ${forecast}. ${data.advice || ''}`
            : (data.advice || 'Weather forecast is unavailable.');
    }
    const tasks = (data.tasks || []).filter((task) => !selectedSeasonId || task.seasonId === selectedSeasonId);
    const groups = new Map();
    const growing = (data.growing || []).filter((crop) => !selectedSeasonId || crop.seasonId === selectedSeasonId);
    for (const crop of growing) {
        groups.set(crop.seasonId, { ...crop, tasks: [] });
    }
    for (const task of tasks) {
        if (!groups.has(task.seasonId)) {
            groups.set(task.seasonId, {
                seasonId: task.seasonId,
                crop: task.crop,
                parcelName: task.parcelName,
                ageDays: task.ageDays,
                tasks: []
            });
        }
        groups.get(task.seasonId).tasks.push(task);
    }
    const cropGroups = [...groups.values()];
    if (!cropGroups.length) {
        tasksEl.innerHTML = '<div class="empty-state"><p>No crop actions yet. Start a production season to get watering, weeding, and fertiliser reminders for that crop.</p></div>';
        return;
    }
    tasksEl.innerHTML = cropGroups.map((group) => `
        <div class="care-crop">
            <div class="care-crop-title">${group.crop} · ${group.parcelName} · ${group.planted ? `day ${group.ageDays}` : 'land preparation'}</div>
            ${group.variety ? `<div class="care-crop-clear">${group.variety}</div>` : ''}
            ${guideLines(group.guide)}
            ${group.nextAction ? `<div class="care-crop-clear">${group.nextAction}</div>` : ''}
            ${group.tasks.length ? group.tasks.map((task) => `
                <div class="card-item care-task ${task.status}">
                    <div class="card-item-header">
                        <span class="card-item-title">${task.label}</span>
                        <span class="card-item-badge">${task.status === 'due' ? 'Due' : task.status === 'done' ? 'Logged' : 'Rain'}</span>
                    </div>
                    <div class="card-item-details">
                        <div>${task.detail}</div>
                    </div>
                    ${task.status === 'due' ? `<button class="btn-small" onclick="logCareTask('${task.seasonId}','${task.logType || task.type}','${task.label.replace(/'/g, '')}')">Mark done</button>` : ''}
                </div>
            `).join('') : (group.nextAction ? '' : '<div class="care-crop-clear">No action due for this crop today.</div>')}
        </div>
    `).join('');
    const due = tasks.filter((task) => task.status === 'due');
    if (due.length) showToast(`${due.length} crop action${due.length === 1 ? '' : 's'} due today`, 'info');
}

window.logCareTask = async function(seasonId, type, label) {
    try {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const response = await fetch(`${API_BASE}/api/farmers/me/seasons/${seasonId}/activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                activity_type: type,
                activityType: type,
                activity_date: today,
                activityDate: today,
                description: label
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            showToast(errorData.message || 'Could not log this check', 'error');
            return;
        }
        showToast('Logged', 'success');
        loadDailyCare();
        loadHomeSummary();
    } catch (error) {
        showToast('Network error', 'error');
    }
};

async function scheduleCareNotifications(data) {
    const notificationsApi = window.Capacitor?.Plugins?.LocalNotifications;
    if (!notificationsApi) return;
    try {
        const permission = await notificationsApi.requestPermissions();
        if (permission.display && permission.display !== 'granted') return;
        const cancelIds = data.cancelIds || [2201, 2202, 2203];
        await notificationsApi.cancel({ notifications: cancelIds.map((id) => ({ id })) });
        const notifications = [];
        for (const item of data.notifications || []) {
            const when = new Date();
            when.setDate(when.getDate() + (item.dayIndex || 0));
            when.setHours(6, 30, 0, 0);
            if (when.getTime() < Date.now() + 60000) continue;
            notifications.push({
                id: item.id,
                title: item.title,
                body: item.body,
                schedule: { at: when, allowWhileIdle: true }
            });
        }
        if (notifications.length) await notificationsApi.schedule({ notifications });
    } catch (error) {
        console.warn('Could not schedule farm notifications:', error);
    }
}

function parcelSize(parcel) {
    const size = parcel.area_hectares ?? parcel.size_hectares;
    return size == null || size === '' ? '--' : size;
}

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
        console.log('Parcels data:', JSON.stringify(data));
        displayParcels(data.parcels || []);
    } catch (error) {
        console.error('Failed to load parcels:', error);
        showToast('Network error loading parcels', 'error');
        displayParcels([]);
    }
}

function displayParcels(parcels) {
    const container = document.getElementById('parcelsList');
    if (!container) return;
    if (!parcels.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏞️</div><p>No land parcels yet. Tap + Add Parcel.</p></div>';
        return;
    }
    
    container.innerHTML = parcels.map(p => `
        <div class="card-item">
            <div class="card-item-header">
                <span class="card-item-title">${p.parcel_name || 'Parcel'}</span>
                <span class="card-item-badge ${p.status === 'active' ? '' : 'inactive'}">${p.status || 'active'}</span>
            </div>
            <div class="card-item-details">
                <div>📐 Size: ${parcelSize(p)} hectares</div>
                <div>🏷️ Ownership: ${p.ownership_type}</div>
                ${p.soil_type ? `<div>🌱 Soil: ${p.soil_type}</div>` : ''}
                ${p.water_source ? `<div>💧 Water: ${p.water_source}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('show');
    modal.style.display = 'block';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('show');
    modal.style.display = 'none';
}

window.showAddParcel = function() {
    openModal('addParcelModal');
    document.getElementById('parcelName').value = '';
    document.getElementById('parcelSize').value = '';
    document.getElementById('parcelOwnership').value = '';
    document.getElementById('parcelSoilType').value = '';
    document.getElementById('parcelWaterSource').value = '';
    document.getElementById('gpsStatus').textContent = '';
};

window.closeAddParcel = function() {
    closeModal('addParcelModal');
};

let capturedGPS = null;
window.captureGPS = async function() {
    const statusEl = document.getElementById('gpsStatus');
    statusEl.textContent = 'Capturing GPS...';

    try {
        const Geolocation = window.Capacitor?.Plugins?.Geolocation;
        if (!Geolocation) {
            statusEl.textContent = 'GPS is not available on this device.';
            return;
        }

        const permission = await Geolocation.requestPermissions();
        const granted = permission.location === 'granted' || permission.coarseLocation === 'granted';
        if (!granted) {
            statusEl.textContent = 'Allow location access, then try again.';
            return;
        }

        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
        });
        capturedGPS = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
        statusEl.textContent = `GPS captured: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    } catch (error) {
        statusEl.textContent = error?.message || 'Failed to capture GPS. Turn on location and try again.';
        console.error('GPS error:', error);
    }
};

document.getElementById('addParcelForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const size = parseFloat(document.getElementById('parcelSize').value);
    const data = {
        parcel_name: document.getElementById('parcelName').value,
        parcelName: document.getElementById('parcelName').value,
        area_hectares: size,
        sizeHectares: size,
        ownership_type: document.getElementById('parcelOwnership').value,
        ownershipType: document.getElementById('parcelOwnership').value,
        soil_type: document.getElementById('parcelSoilType').value,
        soilType: document.getElementById('parcelSoilType').value,
        water_source: document.getElementById('parcelWaterSource').value,
        waterSource: document.getElementById('parcelWaterSource').value,
        ...(capturedGPS && {
            latitude: capturedGPS.latitude,
            longitude: capturedGPS.longitude,
            gpsLatitude: capturedGPS.latitude,
            gpsLongitude: capturedGPS.longitude
        })
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
            showToast('Parcel added successfully', 'success');
            closeAddParcel();
            loadParcels();
            capturedGPS = null;
        } else {
            const errorData = await response.json().catch(() => ({}));
            showToast(errorData.message || 'Failed to add parcel', 'error');
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
        console.log('Seasons data:', JSON.stringify(data));
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
                ${s.planting_date ? `<div>📅 Planted: ${new Date(s.planting_date).toLocaleDateString()}</div>` : '<div>Land preparation · planting not recorded yet</div>'}
            </div>
        </div>
    `).join('');
}

function populateSeasonSelect(seasons) {
    const select = document.getElementById('activeSeasonSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select a season --</option>' +
        seasons.filter(s => !s.status || s.status === 'active' || s.status === 'planned').map(s => 
            `<option value="${s.id}">${s.crop} - ${s.season_name}</option>`
        ).join('');
    if (selectedSeasonId && [...select.options].some((option) => option.value === selectedSeasonId)) {
        select.value = selectedSeasonId;
        currentSeasonId = selectedSeasonId;
    }
    if (document.getElementById('productionTab')?.classList.contains('active') && select.value) {
        loadSeasonDetails();
    }
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
            (data.parcels || []).map(p => `<option value="${p.id}">${p.parcel_name} (${parcelSize(p)}ha)</option>`).join('');
    } catch (error) {
        console.error('Failed to load parcels:', error);
    }
    
    openModal('addSeasonModal');
    document.getElementById('seasonCrop').value = '';
    const varietyInput = document.getElementById('seasonVariety');
    varietyInput.value = '';
    varietyInput.dataset.touched = '';
    document.getElementById('seasonArea').value = '';
    const guideEl = document.getElementById('seasonGuide');
    if (guideEl) guideEl.textContent = '';
};

async function refreshSeasonGuide(event) {
    const guideEl = document.getElementById('seasonGuide');
    const crop = document.getElementById('seasonCrop')?.value;
    if (!guideEl || !authToken) return;
    if (!crop) {
        guideEl.textContent = '';
        return;
    }
    const hectares = document.getElementById('seasonArea')?.value;
    const params = new URLSearchParams({ crop });
    if (hectares) params.set('hectares', hectares);
    try {
        const response = await fetch(`${API_BASE}/api/farmers/me/guide?${params}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) return;
        const brief = await response.json();
        const varietyInput = document.getElementById('seasonVariety');
        if (event?.target?.id === 'seasonCrop' && varietyInput) varietyInput.dataset.touched = '';
        if (varietyInput && brief.varieties && !varietyInput.dataset.touched) {
            varietyInput.value = brief.varieties;
        }
        guideEl.textContent = [brief.phaseNote, brief.note, brief.variety, brief.planting, brief.seed, brief.margin, brief.suppliers, brief.buyers].filter(Boolean).join('\n');
    } catch (error) {
        console.warn('Could not load crop guide:', error);
    }
}

document.getElementById('seasonCrop')?.addEventListener('change', refreshSeasonGuide);
document.getElementById('seasonArea')?.addEventListener('input', refreshSeasonGuide);
document.getElementById('seasonVariety')?.addEventListener('input', (event) => {
    event.target.dataset.touched = '1';
});

window.closeAddSeason = function() {
    closeModal('addSeasonModal');
};

document.getElementById('addSeasonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const area = parseFloat(document.getElementById('seasonArea').value);
    const data = {
        parcel_id: document.getElementById('seasonParcel').value,
        parcelId: document.getElementById('seasonParcel').value,
        crop: document.getElementById('seasonCrop').value,
        variety: document.getElementById('seasonVariety').value,
        area_hectares: area,
        areaHectares: area,
        season_name: document.getElementById('seasonName').value,
        seasonName: document.getElementById('seasonName').value
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
        console.log('Household data:', JSON.stringify(data));
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
    openModal('addMemberModal');
    document.getElementById('memberName').value = '';
    document.getElementById('memberRelationship').value = '';
    document.getElementById('memberAge').value = '';
    document.getElementById('memberGender').value = '';
    document.getElementById('memberFarming').checked = false;
};

window.closeAddMember = function() {
    closeModal('addMemberModal');
};

document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        name: document.getElementById('memberName').value,
        relationship: document.getElementById('memberRelationship').value,
        age: parseInt(document.getElementById('memberAge').value) || null,
        gender: document.getElementById('memberGender').value || null,
        involved_in_farming: document.getElementById('memberFarming').checked,
        involvedInFarming: document.getElementById('memberFarming').checked
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
    selectedSeasonId = currentSeasonId || selectedSeasonId;
    if (Preferences && selectedSeasonId) {
        await Preferences.set({ key: 'active_season', value: selectedSeasonId });
    }
    const fieldSelect = document.getElementById('fieldSelect');
    if (fieldSelect && [...fieldSelect.options].some((option) => option.value === selectedSeasonId)) {
        fieldSelect.value = selectedSeasonId;
    }
    if (latestCare) renderCare(latestCare);
    
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
            document.getElementById('daysSincePlanting').textContent = 'Prep';
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
                    ${(a.cost_mwk || a.labor_cost) ? `<span>MWK ${Number(a.cost_mwk || a.labor_cost).toLocaleString()}</span>` : ''}
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
    openModal('logActivityModal');
    document.getElementById('activityDate').value = new Date().toISOString().split('T')[0];
};

window.closeLogActivity = function() {
    closeModal('logActivityModal');
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
        displayMonitoring(data.records || data.monitoring || []);
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
            <div class="timeline-date">${new Date(r.observation_date || r.monitoring_date).toLocaleDateString()}</div>
            <div class="timeline-content">
                <div class="timeline-title">${r.crop_stage || 'Observation'}</div>
                ${r.crop_health ? `<div class="timeline-description">Health: ${r.crop_health}</div>` : ''}
                ${(r.pests_observed || r.pest_observed) ? `<div class="timeline-description">Pests: ${r.pests_observed || r.pest_observed}</div>` : ''}
                ${(r.diseases_observed || r.disease_observed) ? `<div class="timeline-description">Diseases: ${r.diseases_observed || r.disease_observed}</div>` : ''}
                ${r.notes ? `<div class="timeline-description">${r.notes}</div>` : ''}
            </div>
        </div>
    `).join('');
}

window.showRecordMonitoring = function() {
    openModal('recordMonitoringModal');
    document.getElementById('monitoringDate').value = new Date().toISOString().split('T')[0];
};

window.closeRecordMonitoring = function() {
    closeModal('recordMonitoringModal');
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
                    <span>MWK ${Number(c.amount || c.total_cost || 0).toLocaleString()}</span>
                    ${c.payment_method ? `<span>💳 ${c.payment_method}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

window.showAddCost = function() {
    openModal('addCostModal');
    document.getElementById('costDate').value = new Date().toISOString().split('T')[0];
};

window.closeAddCost = function() {
    closeModal('addCostModal');
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
window.photographPlant = photographPlant;
window.confirmPlantSign = confirmPlantSign;
