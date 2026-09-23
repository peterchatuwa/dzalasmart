// Nzeru Farmer - Mobile App JavaScript
// Offline-first data collection for farmers

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';

// App State
let currentLocation = null;
let capturedPhotos = {
    farmer: null,
    parcel: null,
    crop: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeForms();
    loadStats();
    checkServerStatus();
});

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Initialize Form Handlers
function initializeForms() {
    // Farmer Registration Form
    document.getElementById('farmerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveFarmer();
    });
    
    // Parcel Form
    document.getElementById('parcelForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveParcel();
    });
    
    // Crop Form
    document.getElementById('cropForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveCrop();
    });
}

// Save Farmer Data
async function saveFarmer() {
    const data = {
        id: generateId(),
        type: 'farmer',
        timestamp: new Date().toISOString(),
        synced: false,
        data: {
            fullName: document.getElementById('farmerName').value,
            phone: document.getElementById('farmerPhone').value,
            district: document.getElementById('farmerDistrict').value,
            epa: document.getElementById('farmerEpa').value,
            village: document.getElementById('farmerVillage').value || null,
            gender: document.getElementById('farmerGender').value || null,
            dateOfBirth: document.getElementById('farmerDob').value || null,
            householdSize: parseInt(document.getElementById('farmerHousehold').value) || null,
            householdType: document.getElementById('farmerHouseholdType').value || null,
            livestock: document.getElementById('farmerLivestock').value || null,
            photo: capturedPhotos.farmer
        }
    };
    
    try {
        await saveToLocal('farmer', data);
        showToast('✓ Farmer registered successfully!', 'success');
        document.getElementById('farmerForm').reset();
        capturedPhotos.farmer = null;
        document.getElementById('farmerPhotoPreview').innerHTML = '';
        await loadStats();
    } catch (error) {
        showToast('✗ Error saving farmer data', 'error');
        console.error(error);
    }
}

// Save Parcel Data
async function saveParcel() {
    const data = {
        id: generateId(),
        type: 'parcel',
        timestamp: new Date().toISOString(),
        synced: false,
        data: {
            farmerPhone: document.getElementById('parcelFarmerPhone').value,
            name: document.getElementById('parcelName').value,
            size: parseFloat(document.getElementById('parcelSize').value),
            tenure: document.getElementById('parcelTenure').value || null,
            soilType: document.getElementById('parcelSoil').value || null,
            waterSource: document.getElementById('parcelWater').value || null,
            location: currentLocation,
            photo: capturedPhotos.parcel
        }
    };
    
    try {
        await saveToLocal('parcel', data);
        showToast('✓ Parcel saved successfully!', 'success');
        document.getElementById('parcelForm').reset();
        capturedPhotos.parcel = null;
        currentLocation = null;
        document.getElementById('parcelPhotoPreview').innerHTML = '';
        document.getElementById('locationDisplay').innerHTML = '';
        await loadStats();
    } catch (error) {
        showToast('✗ Error saving parcel data', 'error');
        console.error(error);
    }
}

// Save Crop Data
async function saveCrop() {
    const data = {
        id: generateId(),
        type: 'crop',
        timestamp: new Date().toISOString(),
        synced: false,
        data: {
            farmerPhone: document.getElementById('cropFarmerPhone').value,
            parcelName: document.getElementById('cropParcelName').value,
            cropType: document.getElementById('cropType').value,
            variety: document.getElementById('cropVariety').value || null,
            plantingDate: document.getElementById('cropPlantDate').value || null,
            expectedHarvest: document.getElementById('cropHarvestDate').value || null,
            areaPlanted: parseFloat(document.getElementById('cropArea').value) || null,
            expectedYield: parseInt(document.getElementById('cropYield').value) || null,
            irrigation: document.getElementById('cropIrrigation').value,
            photo: capturedPhotos.crop,
            notes: document.getElementById('cropNotes').value || null
        }
    };
    
    try {
        await saveToLocal('crop', data);
        showToast('✓ Crop data saved successfully!', 'success');
        document.getElementById('cropForm').reset();
        capturedPhotos.crop = null;
        document.getElementById('cropPhotoPreview').innerHTML = '';
        await loadStats();
    } catch (error) {
        showToast('✗ Error saving crop data', 'error');
        console.error(error);
    }
}

// Capture Photo
async function capturePhoto(type) {
    try {
        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera
        });
        
        capturedPhotos[type] = image.dataUrl;
        
        // Show preview
        const previewDiv = document.getElementById(`${type}PhotoPreview`);
        previewDiv.innerHTML = `<img src="${image.dataUrl}" alt="${type} photo">`;
        
        showToast('✓ Photo captured!', 'success');
    } catch (error) {
        if (error.message !== 'User cancelled photos app') {
            showToast('✗ Error capturing photo', 'error');
            console.error(error);
        }
    }
}

// Capture GPS Location
async function captureLocation() {
    try {
        showToast('📍 Getting location...', 'info');
        
        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000
        });
        
        currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
        };
        
        // Display location
        const locationDiv = document.getElementById('locationDisplay');
        locationDiv.innerHTML = `
            <strong>Location Captured:</strong><br>
            Lat: ${position.coords.latitude.toFixed(6)}<br>
            Lon: ${position.coords.longitude.toFixed(6)}<br>
            Accuracy: ±${Math.round(position.coords.accuracy)}m
        `;
        locationDiv.classList.remove('empty');
        
        showToast('✓ Location captured!', 'success');
    } catch (error) {
        showToast('✗ Error getting location', 'error');
        console.error(error);
    }
}

// Local Storage Functions
async function saveToLocal(type, data) {
    // Get existing data
    const existing = await Preferences.get({ key: `nzeru_${type}s` });
    const items = existing.value ? JSON.parse(existing.value) : [];
    
    // Add new item
    items.push(data);
    
    // Save back
    await Preferences.set({
        key: `nzeru_${type}s`,
        value: JSON.stringify(items)
    });
    
    // Update pending count
    await updatePendingCount();
}

async function getLocalData(type) {
    const result = await Preferences.get({ key: `nzeru_${type}s` });
    return result.value ? JSON.parse(result.value) : [];
}

async function updatePendingCount() {
    const farmers = await getLocalData('farmer');
    const parcels = await getLocalData('parcel');
    const crops = await getLocalData('crop');
    
    const pending = [...farmers, ...parcels, ...crops].filter(item => !item.synced);
    
    await Preferences.set({
        key: 'nzeru_pending_count',
        value: pending.length.toString()
    });
}

// Load Statistics
async function loadStats() {
    const pendingResult = await Preferences.get({ key: 'nzeru_pending_count' });
    const syncedResult = await Preferences.get({ key: 'nzeru_synced_today' });
    const lastSyncResult = await Preferences.get({ key: 'nzeru_last_sync' });
    
    document.getElementById('pendingCount').textContent = pendingResult.value || '0';
    document.getElementById('syncedCount').textContent = syncedResult.value || '0';
    document.getElementById('lastSync').textContent = lastSyncResult.value || 'Never';
}

// Sync All Data
async function syncAllData() {
    try {
        showToast('🔄 Syncing data...', 'info');
        
        // Get all unsynced data
        const farmers = await getLocalData('farmer');
        const parcels = await getLocalData('parcel');
        const crops = await getLocalData('crop');
        
        const unsyncedFarmers = farmers.filter(f => !f.synced);
        const unsyncedParcels = parcels.filter(p => !p.synced);
        const unsyncedCrops = crops.filter(c => !c.synced);
        
        const totalUnsynced = unsyncedFarmers.length + unsyncedParcels.length + unsyncedCrops.length;
        
        if (totalUnsynced === 0) {
            showToast('✓ All data is already synced!', 'success');
            return;
        }
        
        // Sync farmers
        let syncedCount = 0;
        for (const farmer of unsyncedFarmers) {
            const success = await syncItem('farmers', farmer);
            if (success) {
                farmer.synced = true;
                syncedCount++;
            }
        }
        
        // Sync parcels
        for (const parcel of unsyncedParcels) {
            const success = await syncItem('parcels', parcel);
            if (success) {
                parcel.synced = true;
                syncedCount++;
            }
        }
        
        // Sync crops
        for (const crop of unsyncedCrops) {
            const success = await syncItem('crops', crop);
            if (success) {
                crop.synced = true;
                syncedCount++;
            }
        }
        
        // Save updated data
        await Preferences.set({ key: 'nzeru_farmers', value: JSON.stringify(farmers) });
        await Preferences.set({ key: 'nzeru_parcels', value: JSON.stringify(parcels) });
        await Preferences.set({ key: 'nzeru_crops', value: JSON.stringify(crops) });
        
        // Update stats
        const now = new Date().toLocaleString();
        await Preferences.set({ key: 'nzeru_last_sync', value: now });
        await Preferences.set({ key: 'nzeru_synced_today', value: syncedCount.toString() });
        await updatePendingCount();
        await loadStats();
        
        // Log sync
        logSync(`Synced ${syncedCount} of ${totalUnsynced} records`, 'success');
        
        showToast(`✓ Synced ${syncedCount} records!`, 'success');
    } catch (error) {
        logSync('Sync failed: ' + error.message, 'error');
        showToast('✗ Sync failed. Check connection.', 'error');
        console.error(error);
    }
}

// Sync Single Item to Server
async function syncItem(endpoint, item) {
    try {
        const response = await fetch(`https://api.zammunda.com/api/mobile/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(item.data)
        });
        
        return response.ok;
    } catch (error) {
        console.error(`Error syncing ${endpoint}:`, error);
        return false;
    }
}

// Check Server Status
async function checkServerStatus() {
    try {
        const response = await fetch('https://api.zammunda.com/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            document.getElementById('serverStatus').textContent = '✓ Online';
            document.getElementById('serverStatus').style.color = 'var(--success)';
            document.querySelector('.status-dot').classList.remove('offline');
            document.getElementById('syncText').textContent = 'Online Mode';
        } else {
            throw new Error('Server unavailable');
        }
    } catch (error) {
        document.getElementById('serverStatus').textContent = '✗ Offline';
        document.getElementById('serverStatus').style.color = 'var(--error)';
        document.querySelector('.status-dot').classList.add('offline');
        document.getElementById('syncText').textContent = 'Offline Mode';
    }
}

// View Local Data
async function viewLocalData() {
    const farmers = await getLocalData('farmer');
    const parcels = await getLocalData('parcel');
    const crops = await getLocalData('crop');
    
    const summary = `
Local Data Summary:
-------------------
Farmers: ${farmers.length}
Parcels: ${parcels.length}
Crops: ${crops.length}

Total Records: ${farmers.length + parcels.length + crops.length}
    `;
    
    alert(summary);
}

// Log Sync Activity
async function logSync(message, type) {
    const historyDiv = document.getElementById('syncHistory');
    const entry = document.createElement('div');
    entry.className = `sync-entry ${type}`;
    entry.innerHTML = `
        <strong>${new Date().toLocaleTimeString()}</strong><br>
        ${message}
    `;
    
    if (historyDiv.querySelector('.text-muted')) {
        historyDiv.innerHTML = '';
    }
    
    historyDiv.insertBefore(entry, historyDiv.firstChild);
    
    // Keep only last 10 entries
    while (historyDiv.children.length > 10) {
        historyDiv.removeChild(historyDiv.lastChild);
    }
}

// Utility Functions
function generateId() {
    return 'nzeru_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions globally available
window.capturePhoto = capturePhoto;
window.captureLocation = captureLocation;
window.syncAllData = syncAllData;
window.viewLocalData = viewLocalData;
