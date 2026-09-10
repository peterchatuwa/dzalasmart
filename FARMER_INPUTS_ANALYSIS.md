# Farmer & Agricultural Inputs Analysis

## Current State Assessment

### What EXISTS (Stage 0 - "Input Redemption")
- ✅ Stage name `input_redemption` in `STAGES` array
- ✅ Stage can be logged as an event in `season_events` table
- ✅ Visit tracking mentions "Input voucher redeemed" as a follow-up reason

### What is MISSING (Everything Else)

#### 1. Database Schema - NO TABLES FOR:
- ❌ Input catalog (seeds, fertilizers, pesticides, tools)
- ❌ Input suppliers/vendors
- ❌ Input vouchers (allocation, distribution)
- ❌ Voucher redemptions (who redeemed what, when, where)
- ❌ Input inventory tracking
- ❌ Input pricing & subsidy schemes
- ❌ Farmer input allocations by season
- ❌ Government subsidy programs (FISP, etc.)

#### 2. Backend Logic - NO IMPLEMENTATION FOR:
- ❌ Create/manage input catalog
- ❌ Issue vouchers to farmers
- ❌ Redeem vouchers at agro-dealers
- ❌ Track input distribution
- ❌ Validate voucher eligibility
- ❌ Calculate subsidy amounts
- ❌ Generate redemption receipts
- ❌ Report on input distribution by district/EPA
- ❌ Track input usage vs crop plan

#### 3. API Endpoints - NONE EXIST:
- ❌ `GET /api/inputs/catalog` - List available inputs
- ❌ `GET /api/farmers/me/vouchers` - Farmer's allocated vouchers
- ❌ `POST /api/farmers/me/vouchers/:id/redeem` - Redeem a voucher
- ❌ `GET /api/staff/vouchers` - Staff view of voucher distribution
- ❌ `POST /api/staff/vouchers/issue` - Issue vouchers to farmers
- ❌ `POST /api/staff/vouchers/redeem` - Staff-assisted redemption
- ❌ `GET /api/staff/inputs/inventory` - Input stock levels
- ❌ `GET /api/staff/inputs/redemptions` - Redemption history

#### 4. Frontend UI - COMPLETELY ABSENT:
- ❌ Farmer view: My input vouchers
- ❌ Farmer view: Voucher redemption flow
- ❌ Farmer view: Input redemption history
- ❌ Staff view: Issue vouchers to farmers
- ❌ Staff view: Process voucher redemptions
- ❌ Staff view: Input inventory management
- ❌ Staff view: Redemption reports by district/EPA
- ❌ Agro-dealer portal for redemption processing

#### 5. USSD Integration - MISSING:
- ❌ Check voucher balance via USSD
- ❌ View allocated inputs via USSD
- ❌ Find nearest agro-dealer via USSD
- ❌ Receive voucher activation notifications

#### 6. Business Logic - NOT IMPLEMENTED:
- ❌ Voucher eligibility rules (farm size, crop type, district)
- ❌ Subsidy calculation (FISP rates, farmer contribution)
- ❌ Voucher expiration & validity periods
- ❌ Redemption limits (quantity, timing)
- ❌ Input package definitions (e.g., "Maize starter pack")
- ❌ Quality assurance for input redemption
- ❌ Fraud prevention (duplicate redemption, fake vouchers)

## Critical Gaps Analysis

### 1. Farmer Journey - Completely Broken
**Current flow:**
1. Farmer registers ✅
2. Farmer logs "Input Redemption" stage ✅
3. **But there's nothing to redeem!** ❌
4. No vouchers, no inputs, no tracking

**Should be:**
1. Farmer registers ✅
2. Extension officer assesses farm & allocates inputs
3. System issues vouchers (digital/SMS)
4. Farmer redeems at agro-dealer with voucher code
5. System logs redemption, updates inventory
6. Farmer proceeds to land preparation with inputs

### 2. Staff Workflow - Non-existent
**Current:** Staff can view farmers but can't:
- Assess input needs based on farm plan
- Issue vouchers
- Process redemptions
- Track distribution

**Should be:**
- Input needs assessment per farmer
- Voucher generation & distribution
- Redemption processing at agro-dealers
- Real-time inventory tracking
- District/EPA-level reporting

### 3. Data Integrity - No Accountability
**Current:** 
- Farmers can log "Input Redemption" without actually redeeming anything
- No proof of redemption
- No input tracking
- No audit trail

**Should be:**
- Each redemption linked to specific voucher
- Timestamps, locations, quantities recorded
- Staff/agro-dealer signatures
- QR codes or SMS verification
- Complete audit trail

### 4. Government Subsidy Programs - Missing
Malawi's FISP (Farm Input Subsidy Programme):
- ❌ No voucher types (subsidized vs commercial)
- ❌ No subsidy rates (government % vs farmer %)
- ❌ No beneficiary selection criteria
- ❌ No redemption center registration
- ❌ No compliance reporting for government

## Implementation Priority

### Phase 1: Core Input & Voucher System (HIGH PRIORITY)
**Goal:** Enable basic input voucher issuance and redemption

**Database:**
```sql
-- Input catalog
CREATE TABLE inputs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'seed', 'fertilizer', 'pesticide', 'tool'
  unit TEXT NOT NULL, -- 'kg', 'liter', 'piece'
  standard_price INTEGER NOT NULL,
  supplier TEXT,
  created_at BIGINT NOT NULL
);

-- Farmer vouchers
CREATE TABLE farmer_vouchers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- e.g., "FISP-2024-001234"
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  issued_by TEXT NOT NULL REFERENCES staff(id),
  season TEXT NOT NULL, -- e.g., "2024/25"
  status TEXT NOT NULL, -- 'active', 'redeemed', 'expired', 'cancelled'
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  redeemed_at BIGINT
);

-- Voucher line items (what inputs this voucher covers)
CREATE TABLE voucher_inputs (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES farmer_vouchers(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  quantity DOUBLE PRECISION NOT NULL,
  unit_price INTEGER NOT NULL, -- actual price (after subsidy)
  subsidy_rate DOUBLE PRECISION NOT NULL, -- 0.0 to 1.0 (e.g., 0.7 = 70% subsidy)
  farmer_contribution INTEGER NOT NULL
);

-- Redemption records
CREATE TABLE input_redemptions (
  id TEXT PRIMARY KEY,
  voucher_id TEXT NOT NULL REFERENCES farmer_vouchers(id),
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  agro_dealer TEXT NOT NULL,
  location TEXT NOT NULL, -- redemption center
  staff_id TEXT REFERENCES staff(id), -- staff who processed it
  redeemed_at BIGINT NOT NULL,
  notes TEXT
);

-- Redemption line items (what was actually collected)
CREATE TABLE redemption_inputs (
  id TEXT PRIMARY KEY,
  redemption_id TEXT NOT NULL REFERENCES input_redemptions(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  quantity_issued DOUBLE PRECISION NOT NULL,
  batch_number TEXT,
  expiry_date BIGINT
);
```

**Backend API:**
- `server/src/inputs.js` - Input catalog management
- `server/src/vouchers.js` - Voucher issuance & redemption logic
- API endpoints (see section 3 above)

**Frontend:**
- Farmer voucher dashboard
- Staff voucher issuance form
- Staff redemption processing interface

**USSD:**
- Check my vouchers (*413# → 8 → Check vouchers)
- View voucher details

### Phase 2: Input Inventory & Distribution (MEDIUM PRIORITY)
**Goal:** Track input stock levels and distribution efficiency

**Database:**
```sql
-- Distribution centers (agro-dealers, cooperatives)
CREATE TABLE distribution_centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  epa TEXT,
  type TEXT NOT NULL, -- 'agro_dealer', 'cooperative', 'government_depot'
  contact_phone TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  created_at BIGINT NOT NULL
);

-- Input inventory by center
CREATE TABLE input_inventory (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES distribution_centers(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  quantity_available DOUBLE PRECISION NOT NULL,
  quantity_allocated DOUBLE PRECISION NOT NULL, -- reserved for vouchers
  last_updated BIGINT NOT NULL
);

-- Stock movements
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL REFERENCES distribution_centers(id),
  input_id TEXT NOT NULL REFERENCES inputs(id),
  movement_type TEXT NOT NULL, -- 'received', 'issued', 'adjustment', 'transfer'
  quantity DOUBLE PRECISION NOT NULL,
  staff_id TEXT REFERENCES staff(id),
  reference_id TEXT, -- voucher_id, redemption_id, or transfer_id
  notes TEXT,
  created_at BIGINT NOT NULL
);
```

**Features:**
- Real-time stock tracking
- Low stock alerts
- Reorder automation
- Distribution center locator
- Transfer between centers

### Phase 3: Advanced Features (LOWER PRIORITY)
- Input quality verification
- Farmer input usage tracking (actual vs planned)
- Yield correlation with input usage
- Bulk ordering for cooperatives
- Input credit/loan integration
- Mobile money integration for farmer contributions
- Biometric verification for redemption
- QR code vouchers

## Farmer Management - Also Needs Work

### Current Gaps:
1. ❌ No farmer groups/cooperatives linking
2. ❌ No household member tracking
3. ❌ No land tenure information
4. ❌ No asset inventory (livestock, equipment)
5. ❌ No income sources beyond farming
6. ❌ No extension visit scheduling
7. ❌ No training/capacity building tracking
8. ❌ No certification tracking (organic, fair trade, etc.)

### Should Add:
```sql
-- Farmer groups
CREATE TABLE farmer_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'cooperative', 'club', 'association'
  district TEXT NOT NULL,
  epa TEXT,
  leader_farmer_id TEXT REFERENCES farmers(id),
  registration_number TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_group_members (
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  group_id TEXT NOT NULL REFERENCES farmer_groups(id),
  role TEXT NOT NULL, -- 'member', 'leader', 'treasurer', 'secretary'
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (farmer_id, group_id)
);

-- Farmer household
CREATE TABLE farmer_household_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- 'spouse', 'child', 'parent', 'other'
  age INTEGER,
  gender TEXT,
  involved_in_farming BOOLEAN NOT NULL DEFAULT 0
);

-- Land tenure
CREATE TABLE farmer_land_parcels (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  parcel_name TEXT,
  hectares DOUBLE PRECISION NOT NULL,
  tenure_type TEXT NOT NULL, -- 'owned', 'rented', 'customary', 'borrowed'
  soil_type TEXT,
  irrigation_available BOOLEAN NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

-- Extension visits
CREATE TABLE extension_visits (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  visit_date BIGINT NOT NULL,
  purpose TEXT NOT NULL,
  recommendations TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT 0,
  follow_up_date BIGINT,
  created_at BIGINT NOT NULL
);

-- Training participation
CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL, -- 'pest_management', 'soil_health', 'market_access', etc.
  district TEXT NOT NULL,
  epa TEXT,
  session_date BIGINT NOT NULL,
  facilitator_id TEXT REFERENCES staff(id),
  created_at BIGINT NOT NULL
);

CREATE TABLE training_attendance (
  session_id TEXT NOT NULL REFERENCES training_sessions(id),
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  attended BOOLEAN NOT NULL DEFAULT 1,
  certificate_issued BOOLEAN NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, farmer_id)
);
```

## Summary: Work Required

### Database: 15+ new tables needed
- 4 tables for input catalog & vouchers (Phase 1)
- 3 tables for inventory & distribution (Phase 2)
- 8+ tables for enhanced farmer management

### Backend: 2 new modules + expanded features
- `server/src/inputs.js` - Input catalog CRUD
- `server/src/vouchers.js` - Voucher lifecycle management
- Expand `server/src/farmers.js` - Groups, household, land parcels
- Expand `server/src/staff.js` - Extension visits, training

### API: 20+ new endpoints
- Input catalog (5 endpoints)
- Voucher issuance (4 endpoints)
- Voucher redemption (6 endpoints)
- Inventory management (5 endpoints)
- Distribution centers (3 endpoints)
- Farmer groups (4 endpoints)
- Extension visits (3 endpoints)

### Frontend: Major UI additions
- Farmer voucher dashboard (new view)
- Staff voucher management (new section)
- Staff redemption processing (new section)
- Input inventory dashboard (new section)
- Farmer groups management (new section)
- Extension visit scheduler (new section)

### USSD: New menu branches
- Menu 8: Input vouchers
  - 8.1: Check my vouchers
  - 8.2: Nearest agro-dealer
  - 8.3: Voucher help

## Recommended Approach

**Start with Phase 1: Core Input & Voucher System**

1. **Database First** (1-2 hours)
   - Add 4 core tables
   - Create seed data for input catalog
   - Add indexes

2. **Backend Logic** (3-4 hours)
   - `inputs.js` - CRUD for input catalog
   - `vouchers.js` - Issue, redeem, validate vouchers
   - Add API endpoints

3. **Staff UI** (2-3 hours)
   - Voucher issuance form
   - Redemption processing interface
   - Basic reporting

4. **Farmer UI** (2-3 hours)
   - My vouchers dashboard
   - Redemption history
   - Agro-dealer locator

5. **USSD Integration** (1-2 hours)
   - Check vouchers
   - View voucher details

6. **Testing & Documentation** (1-2 hours)
   - Seed test vouchers
   - API documentation
   - User guide

**Total estimated implementation time: 10-16 hours of focused work**

This is a MAJOR gap that needs immediate attention if this system is to be useful for Malawian farmers.
