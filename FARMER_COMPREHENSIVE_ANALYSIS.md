# Farmer Comprehensive Analysis: What's Missing

## Current Farmer UI Structure Analysis

### ✅ What EXISTS in HTML (Fully Implemented)

1. **Authentication** ✅
   - Login form (phone + PIN)
   - Registration form (name, phone, PIN, district, EPA)
   - Demo accounts (Grace, Joseph, Estere)

2. **Farmer Passport** ✅
   - Code, name, district, EPA
   - Grade/credit score
   - Net income, warehouse loan
   - Status checks

3. **Input Vouchers** ✅ (JUST ADDED)
   - View vouchers (active/redeemed)
   - Voucher details
   - Subsidy information

4. **GPS Plot** ✅
   - Coordinates, area (hectares)
   - NDVI (satellite vegetation index)
   - Polygon visualization
   - "Use my location" button
   - OpenStreetMap link

5. **Season Progress** ✅
   - Current stage (8 stages)
   - Next stage
   - "Log next milestone" button
   - Season event log with channel tracking

6. **Weather Watch** ✅
   - Live weather (temperature, humidity, rain, wind)
   - 5-day forecast
   - District alerts
   - Seasonal advice

7. **Market Intelligence** ✅
   - Live prices from multiple sources (NAMIS, ULIMI, etc.)
   - Price history (30 days)
   - Price trends (charts)
   - District comparison
   - Market opportunities
   - Price alerts (create/manage)
   - Export to CSV

8. **Crop & Pest Assistant** ✅
   - Multilingual (English, Chichewa, Tumbuka)
   - Soil type selector
   - Nutrient status selector
   - Topic shortcuts (weather, market, crop, pest)
   - Chat window

9. **Plan My Farm** ✅
   - Crop selection (multiple crops)
   - Farm readiness (water, experience, storage, equipment)
   - Budget breakdown
   - Daily plan/calendar
   - Cash flow projection
   - Decision support

10. **Warehouse Receipts** ✅
    - Grain intake records
    - Loan offers
    - Accept loan button

---

## ❌ What's MISSING in Database vs UI

### CRITICAL GAPS

#### 1. **Farmer Basic Info - INCOMPLETE**

**HTML shows:**
- Farmer code: `MW-LIL-1234-5678` ✅
- Name: `Grace Banda` ✅
- Phone: `+265888000001` ✅
- District: `Lilongwe` ✅
- EPA: `Zidyana` ✅
- Region: `Central` ✅

**Database has:**
```sql
CREATE TABLE farmers (
  id, code, name, phone, pin_hash,
  district, epa, region,
  soil_type, nutrient_status,  -- Only these two extra fields
  created_at
)
```

**MISSING in database:**
- ❌ Gender (male/female/other)
- ❌ Age / Date of birth
- ❌ National ID number
- ❌ Physical address / village name
- ❌ Marital status
- ❌ Household size (number of dependents)
- ❌ Primary language (Chichewa/Tumbuka/English/other)
- ❌ Education level
- ❌ Farming as primary income (yes/no)
- ❌ Years of farming experience
- ❌ Registration source (mobile app/USSD/extension officer/cooperative)
- ❌ Verification status (unverified/verified/suspended)
- ❌ Last active timestamp
- ❌ Profile photo URL
- ❌ Email address (optional)
- ❌ Alternative phone number

**Why it matters:**
- Gender quotas for FISP targeting
- Age affects credit risk assessment
- National ID for KYC compliance
- Village for extension officer assignment
- Household size for input allocation calculations
- Language for USSD menu localization
- Education level for training recommendations
- Experience level affects crop recommendations
- Verification prevents fraud

---

#### 2. **Farm Assets - COMPLETELY MISSING**

**UI references:**
- Plan My Farm: "Storage facility" ✅
- Plan My Farm: "Own equipment" ✅
- Plan My Farm: "Water source" ✅

**Database has:**
- ❌ NOTHING

**Should have:**
```sql
CREATE TABLE farmer_assets (
  id TEXT PRIMARY KEY,
  farmer_id TEXT REFERENCES farmers(id),
  asset_type TEXT NOT NULL,  -- 'livestock', 'equipment', 'infrastructure', 'vehicle'
  asset_name TEXT NOT NULL,  -- 'Ox cart', 'Hoe', 'Chicken coop', 'Borehole'
  quantity INTEGER DEFAULT 1,
  condition TEXT,  -- 'excellent', 'good', 'fair', 'poor'
  acquisition_date BIGINT,
  estimated_value INTEGER,
  notes TEXT,
  created_at BIGINT NOT NULL
);

-- Specific asset tables for better tracking
CREATE TABLE farmer_livestock (
  id TEXT PRIMARY KEY,
  farmer_id TEXT REFERENCES farmers(id),
  animal_type TEXT NOT NULL,  -- 'cattle', 'goat', 'chicken', 'pig', 'rabbit'
  count INTEGER NOT NULL,
  purpose TEXT,  -- 'draft', 'meat', 'dairy', 'eggs', 'breeding'
  last_updated BIGINT NOT NULL
);

CREATE TABLE farmer_equipment (
  id TEXT PRIMARY KEY,
  farmer_id TEXT REFERENCES farmers(id),
  equipment_type TEXT NOT NULL,  -- 'plow', 'cart', 'sprayer', 'hoe', 'wheelbarrow'
  ownership TEXT NOT NULL,  -- 'owned', 'rented', 'borrowed', 'shared'
  condition TEXT,
  last_serviced BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_infrastructure (
  id TEXT PRIMARY KEY,
  farmer_id TEXT REFERENCES farmers(id),
  infrastructure_type TEXT NOT NULL,  -- 'storage', 'borehole', 'irrigation', 'fence', 'shed'
  capacity_or_size TEXT,  -- '5 tons', '50m deep', '2 acres', etc.
  condition TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Assets affect credit worthiness
- Equipment ownership determines labor costs
- Storage affects warehouse receipts strategy
- Livestock = alternative income + draft power
- Infrastructure = farm value + productivity

---

#### 3. **Land Tenure & Parcels - PARTIALLY IMPLEMENTED**

**HTML shows:**
- GPS Plot: Single plot with coordinates ✅
- GPS Plot: Area in hectares ✅
- GPS Plot: NDVI (vegetation health) ✅

**Database has:**
```sql
CREATE TABLE farm_plots (
  farmer_id PRIMARY KEY,  -- ⚠️ Only ONE plot per farmer!
  lat, lon, hectares, polygon_json,
  source, accuracy_m, ndvi,
  updated_at
)
```

**Problems:**
1. ❌ Only ONE plot per farmer (primary key constraint)
2. ❌ No land tenure type (owned/rented/customary/borrowed)
3. ❌ No land ownership documents tracking
4. ❌ No multiple parcels (many farmers have fragmented land)
5. ❌ No parcel-specific soil/topography data
6. ❌ No crop history per parcel
7. ❌ No irrigation availability per parcel

**Should be:**
```sql
-- Remove PRIMARY KEY from farmer_id, make it a regular foreign key
-- Allow multiple plots per farmer

CREATE TABLE farm_land_parcels (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  parcel_name TEXT,  -- 'Main field', 'East plot', 'Valley field'
  hectares DOUBLE PRECISION NOT NULL,
  tenure_type TEXT NOT NULL,  -- 'owned', 'rented', 'customary', 'borrowed', 'leased'
  
  -- Location
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  polygon_json TEXT,
  accuracy_m DOUBLE PRECISION,
  
  -- Characteristics
  soil_type TEXT,
  topography TEXT,  -- 'flat', 'gentle_slope', 'steep', 'valley'
  water_access TEXT,  -- 'none', 'rainfed_only', 'borehole', 'river', 'dam', 'irrigation'
  irrigation_type TEXT,  -- NULL, 'drip', 'sprinkler', 'flood', 'treadle_pump'
  
  -- Satellite data
  ndvi DOUBLE PRECISION,
  last_ndvi_update BIGINT,
  
  -- Ownership docs
  title_deed_number TEXT,
  lease_expiry BIGINT,
  landlord_name TEXT,
  rental_cost_per_season INTEGER,
  
  -- Status
  active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_parcels_farmer ON farm_land_parcels(farmer_id, active);

-- Track what was grown where
CREATE TABLE parcel_crop_history (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL REFERENCES farm_land_parcels(id),
  crop TEXT NOT NULL,
  season TEXT NOT NULL,
  yield_kg DOUBLE PRECISION,
  notes TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Many farmers have 2-4 fragmented parcels
- Tenure affects credit access (banks prefer owned land)
- Crop rotation planning needs parcel-level history
- Irrigation access determines crop choices
- Soil differs between parcels on same farm
- Rental costs affect profitability calculations

---

#### 4. **Household & Labor - COMPLETELY MISSING**

**UI references:**
- Plan My Farm uses household for labor calculations (implicit)
- Passport shows "household indicators" (but no data)

**Database has:**
- ❌ NOTHING

**Should have:**
```sql
CREATE TABLE farmer_household_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  relationship TEXT NOT NULL,  -- 'self', 'spouse', 'child', 'parent', 'sibling', 'other'
  name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  in_school INTEGER DEFAULT 0,  -- Boolean
  contributes_labor INTEGER DEFAULT 0,  -- Boolean
  has_disability INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_labor_sources (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  season TEXT NOT NULL,
  household_labor_days INTEGER NOT NULL DEFAULT 0,
  hired_labor_days INTEGER NOT NULL DEFAULT 0,
  ganyu_labor_days INTEGER NOT NULL DEFAULT 0,  -- Piece work / casual labor
  exchange_labor_days INTEGER NOT NULL DEFAULT 0,  -- Traditional exchange
  total_labor_cost INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Household size affects food security calculations
- Labor availability determines farm size feasibility
- Children in school = different timing needs
- Disabilities may require equipment adaptations
- Labor costs = major expense in budget
- Ganyu tracking shows off-farm income reliance

---

#### 5. **Income & Financial Health - PARTIALLY IMPLEMENTED**

**UI shows:**
- Passport: "Net income" ✅
- Passport: "Credit score" ✅

**Database has:**
- ❌ Net income is CALCULATED from season stages (not stored)
- ❌ Credit score is CALCULATED from stages logged (not stored)
- ❌ No actual income/expense tracking
- ❌ No off-farm income
- ❌ No savings/loans from other sources

**Should have:**
```sql
CREATE TABLE farmer_financial_records (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  season TEXT NOT NULL,
  
  -- Income
  crop_income INTEGER DEFAULT 0,
  livestock_income INTEGER DEFAULT 0,
  off_farm_income INTEGER DEFAULT 0,  -- Ganyu, business, remittances
  total_income INTEGER DEFAULT 0,
  
  -- Expenses
  input_costs INTEGER DEFAULT 0,
  labor_costs INTEGER DEFAULT 0,
  equipment_rental INTEGER DEFAULT 0,
  land_rental INTEGER DEFAULT 0,
  transport_costs INTEGER DEFAULT 0,
  household_expenses INTEGER DEFAULT 0,
  total_expenses INTEGER DEFAULT 0,
  
  -- Net
  net_income INTEGER DEFAULT 0,
  
  -- External credit
  outstanding_loans INTEGER DEFAULT 0,
  savings_balance INTEGER DEFAULT 0,
  
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE farmer_loan_history (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  lender TEXT NOT NULL,  -- 'warehouse', 'bank', 'MFI', 'SACCO', 'informal'
  loan_amount INTEGER NOT NULL,
  interest_rate DOUBLE PRECISION,
  disbursed_at BIGINT NOT NULL,
  due_at BIGINT NOT NULL,
  repaid_amount INTEGER DEFAULT 0,
  repaid_at BIGINT,
  status TEXT NOT NULL,  -- 'active', 'repaid', 'defaulted', 'restructured'
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_savings (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  institution TEXT NOT NULL,  -- 'SACCO', 'Bank', 'VSLA', 'Mobile Money'
  account_number TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated BIGINT NOT NULL
);
```

**Why it matters:**
- Real income tracking = better credit assessments
- Off-farm income affects input purchasing power
- Loan history = creditworthiness indicator
- Savings = financial resilience measure
- Comprehensive finances = better bankability scores

---

#### 6. **Farmer Groups & Cooperatives - COMPLETELY MISSING**

**UI references:**
- Warehouse receipts mentions "cooperative" ✅
- Advisor mentions "register with cooperative" ✅
- Staff has "Cooperative" role ✅

**Database has:**
- ❌ NOTHING

**Should have:**
```sql
CREATE TABLE farmer_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'cooperative', 'club', 'association', 'VSLA', 'SACCO'
  district TEXT NOT NULL,
  epa TEXT,
  registration_number TEXT,
  registration_date BIGINT,
  leader_farmer_id TEXT REFERENCES farmers(id),
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'inactive', 'dissolved'
  member_count INTEGER DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_group_members (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  group_id TEXT NOT NULL REFERENCES farmer_groups(id),
  role TEXT NOT NULL DEFAULT 'member',  -- 'member', 'leader', 'treasurer', 'secretary'
  joined_at BIGINT NOT NULL,
  left_at BIGINT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'inactive'
  UNIQUE(farmer_id, group_id)
);

CREATE INDEX idx_group_members_farmer ON farmer_group_members(farmer_id, status);
CREATE INDEX idx_group_members_group ON farmer_group_members(group_id, status);

CREATE TABLE group_activities (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES farmer_groups(id),
  activity_type TEXT NOT NULL,  -- 'meeting', 'training', 'bulk_purchase', 'group_sale', 'savings'
  activity_date BIGINT NOT NULL,
  participants_count INTEGER,
  description TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Groups get better input prices (bulk purchase)
- Groups access group lending schemes
- Cooperatives handle warehouse receipts
- VSLAs provide savings & credit
- Groups qualify for government programs
- Group membership = social capital indicator

---

#### 7. **Training & Extension Visits - PARTIALLY IMPLEMENTED**

**Database has:**
```sql
CREATE TABLE visits (
  -- Exists in code but checking...
)
```

Let me check...

**Actually EXISTS:**
- `server/src/visits.js` has `visitQueue()` function
- Returns farmers needing visits (pest reports, stalled stages)

**MISSING:**
```sql
CREATE TABLE extension_visits (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  visit_date BIGINT NOT NULL,
  visit_type TEXT NOT NULL,  -- 'routine', 'pest_followup', 'training', 'demo', 'harvest_inspection'
  topics_covered TEXT,  -- JSON array of topics
  recommendations TEXT,
  farmer_feedback TEXT,
  follow_up_required INTEGER DEFAULT 0,
  follow_up_date BIGINT,
  follow_up_notes TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_training_attendance (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  training_session_id TEXT NOT NULL REFERENCES training_sessions(id),
  attended INTEGER NOT NULL DEFAULT 1,
  certificate_issued INTEGER DEFAULT 0,
  test_score INTEGER,
  feedback TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,  -- 'pest_management', 'soil_health', 'market_access', 'post_harvest'
  facilitator_id TEXT REFERENCES staff(id),
  session_date BIGINT NOT NULL,
  district TEXT NOT NULL,
  epa TEXT,
  venue TEXT,
  capacity INTEGER,
  actual_attendance INTEGER DEFAULT 0,
  materials_provided TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Extension visits = personalized advice
- Visit history = service quality tracking
- Training attendance = knowledge improvement
- Certificates = qualification for programs
- Follow-ups = accountability for staff

---

#### 8. **Certifications & Compliance - COMPLETELY MISSING**

**UI doesn't show, but needed for:**
- Organic certification
- Fair trade certification
- Contract farming compliance
- FISP eligibility verification

**Should have:**
```sql
CREATE TABLE farmer_certifications (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  certification_type TEXT NOT NULL,  -- 'organic', 'fairtrade', 'rainforest_alliance', 'GAP'
  certifying_body TEXT NOT NULL,
  certificate_number TEXT,
  issued_date BIGINT NOT NULL,
  expiry_date BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'suspended', 'revoked'
  inspection_due_date BIGINT,
  created_at BIGINT NOT NULL
);

CREATE TABLE farmer_compliance_records (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  program TEXT NOT NULL,  -- 'FISP', 'contract_farming', 'organic', 'export'
  season TEXT NOT NULL,
  compliant INTEGER NOT NULL DEFAULT 1,
  non_compliance_reasons TEXT,
  inspection_date BIGINT,
  inspector_id TEXT REFERENCES staff(id),
  notes TEXT,
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Certifications = premium prices
- Compliance tracking = program eligibility
- Inspection records = audit trail
- Non-compliance reasons = improvement guidance

---

#### 9. **Communication Preferences - MISSING**

**UI has:**
- USSD working ✅
- Mobile app working ✅
- Chat in 3 languages ✅

**Database missing:**
```sql
CREATE TABLE farmer_communication_preferences (
  farmer_id TEXT PRIMARY KEY REFERENCES farmers(id),
  preferred_language TEXT NOT NULL DEFAULT 'en',  -- 'en', 'ny', 'tum'
  sms_notifications INTEGER DEFAULT 1,
  ussd_enabled INTEGER DEFAULT 1,
  call_back_allowed INTEGER DEFAULT 1,
  best_time_to_contact TEXT,  -- 'morning', 'afternoon', 'evening'
  alternative_phone TEXT,
  can_share_data INTEGER DEFAULT 0,  -- Consent for data sharing
  marketing_opt_in INTEGER DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE farmer_notifications (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  notification_type TEXT NOT NULL,  -- 'voucher_issued', 'price_alert', 'weather_alert', 'loan_approved'
  channel TEXT NOT NULL,  -- 'sms', 'ussd', 'app', 'call'
  message TEXT NOT NULL,
  sent_at BIGINT NOT NULL,
  delivered INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  read_at BIGINT
);
```

**Why it matters:**
- Respect language preferences
- SMS budget optimization
- Contact time preferences = better reach
- Delivery tracking = communication effectiveness
- Consent compliance = legal requirement

---

#### 10. **Farmer Relationships & Referrals - MISSING**

**For viral growth:**

```sql
CREATE TABLE farmer_referrals (
  id TEXT PRIMARY KEY,
  referrer_farmer_id TEXT NOT NULL REFERENCES farmers(id),
  referred_farmer_id TEXT NOT NULL REFERENCES farmers(id),
  referral_date BIGINT NOT NULL,
  referral_bonus_paid INTEGER DEFAULT 0,
  bonus_amount INTEGER,
  created_at BIGINT NOT NULL,
  UNIQUE(referrer_farmer_id, referred_farmer_id)
);

CREATE TABLE farmer_relationships (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  related_farmer_id TEXT NOT NULL REFERENCES farmers(id),
  relationship_type TEXT NOT NULL,  -- 'neighbor', 'family', 'business_partner', 'mentor'
  created_at BIGINT NOT NULL
);
```

**Why it matters:**
- Referral programs = growth
- Neighbor connections = peer learning
- Family links = household analysis
- Mentor relationships = knowledge transfer

---

## Summary: Database Schema Gaps

### HIGH PRIORITY (Critical for production)
1. ✅ **Input vouchers** - DONE!
2. ❌ **Farm land parcels** - Multiple plots per farmer
3. ❌ **Farmer groups** - Cooperatives, clubs, associations
4. ❌ **Farmer assets** - Livestock, equipment, infrastructure
5. ❌ **Extension visits** - Visit history and follow-ups
6. ❌ **Household members** - Family size and labor

### MEDIUM PRIORITY (Important for scaling)
7. ❌ **Financial records** - Income, expenses, loans, savings
8. ❌ **Training attendance** - Capacity building tracking
9. ❌ **Communication preferences** - Language, channel, consent
10. ❌ **Certifications** - Organic, fair trade, etc.

### LOW PRIORITY (Nice to have)
11. ❌ **Farmer referrals** - Viral growth tracking
12. ❌ **Compliance records** - Program eligibility
13. ❌ **Notification log** - Delivery tracking

---

## Farmer Fields Analysis

### Current `farmers` Table (11 fields)
```
✅ id, code, name, phone, pin_hash
✅ district, epa, region
✅ soil_type, nutrient_status
✅ created_at
```

### Should Be Extended To (30+ fields)
```
Demographics (9 new):
  - gender, date_of_birth, national_id
  - village, marital_status, household_size
  - primary_language, education_level
  - years_of_experience

Contact (3 new):
  - email, alternative_phone, preferred_contact_time

Registration (4 new):
  - registration_source, registration_channel
  - verified, verification_date

Status (3 new):
  - status (active/suspended/deceased)
  - last_active_at, suspension_reason

Preferences (2 new):
  - preferred_language_code (en/ny/tum)
  - sms_opt_in

Profile (2 new):
  - photo_url, bio

Updated tracking (1 new):
  - updated_at
```

---

## Action Plan

### Phase 1: Critical Foundations (Next)
1. ✅ Input vouchers (DONE)
2. **Fix farm_plots** - Allow multiple parcels
3. **Add farmer_groups** - Cooperatives infrastructure
4. **Add household_members** - Labor calculations
5. **Add farmer_assets** - Equipment & livestock

### Phase 2: Service Delivery
6. **Add extension_visits** - Visit tracking
7. **Add training_sessions** - Capacity building
8. **Add communication_preferences** - Better engagement

### Phase 3: Financial Inclusion
9. **Add financial_records** - Income/expense tracking
10. **Add loan_history** - Credit assessment
11. **Add savings** - Financial health

### Phase 4: Quality & Compliance
12. **Add certifications** - Premium markets
13. **Add compliance_records** - Program eligibility

---

## Recommendation

**Start with #2: Fix farm_plots and add farmer_groups**

These two are foundational:
- **farm_plots** → multiple parcels = accurate planning
- **farmer_groups** → cooperatives = input distribution & marketing

Then we can properly implement the full farmer lifecycle:
1. Register farmer → assign to group
2. Issue vouchers → through cooperative
3. Map multiple plots → accurate NDVI per parcel
4. Plan season → per-parcel crop rotation
5. Log stages → per-parcel tracking
6. Record harvest → per-parcel yields
7. Warehouse receipt → through cooperative
8. Group marketing → better prices

**Everything revolves around the farmer + their land + their group.**
