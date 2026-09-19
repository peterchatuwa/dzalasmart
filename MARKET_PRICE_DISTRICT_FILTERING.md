# Market Price District Filtering

## Summary
Agricultural market prices are now filtered by district to ensure farmers only see prices relevant to their own district.

## What Changed

### Before
Farmers could view market prices from **any district** by passing a `district` query parameter:
```javascript
const district = String(req.query.district || farmer?.district || "").trim() || null;
```

This allowed farmers to access prices like:
- `/api/market/prices?district=Lilongwe` (even if farmer is from Kasungu)
- `/api/market/trends?district=Mzuzu` (even if farmer is from Blantyre)

### After
Farmers can **ONLY** view market prices from their own district:
```javascript
const district = farmer?.district || String(req.query.district || "").trim() || null;
```

Now:
- If a farmer is logged in, their district is **always** used
- Query parameters cannot override the farmer's district
- Unauthenticated requests can still specify a district (for public access)

## Affected Endpoints

The following farmer-facing market endpoints now enforce district filtering:

1. **`GET /api/market`** - Main market dashboard
2. **`GET /api/market/prices`** - Current market prices
3. **`GET /api/market/history`** - Historical price data
4. **`GET /api/market/trends`** - Price trends and analytics
5. **`GET /api/market/export`** - CSV export of prices
6. **`GET /api/market/locations`** - Market locations
7. **`GET /api/market/sources/compare`** - Compare prices from different sources

## Staff Access

Staff endpoints remain **unrestricted** and can view prices from all districts:
- `/api/staff/market/*` - All staff market endpoints
- Staff can filter by district using query parameters as needed

## Implementation Details

### Code Logic
```javascript
// For authenticated farmers
const farmer = await readOptionalFarmer(db, jwtSecret, req);
const district = farmer?.district || String(req.query.district || "").trim() || null;
```

### How It Works
1. Check if request has farmer authentication (JWT token)
2. If farmer is authenticated, use `farmer.district` (from database)
3. If no farmer, fall back to query parameter `req.query.district`
4. Pass district filter to underlying market data functions

### Database Level
The filtering happens in `server/src/market/store.js`:

```javascript
if (filters.district) {
  const hub = nearestWarehouseHub(filters.district);
  params.push(filters.district, hub, `warehouse-${districtSlug(hub)}`, "ulimi-national");
  where.push(`(
    l.district = $${params.length - 3}
    OR l.district = $${params.length - 2}
    OR l.slug = $${params.length - 1}
    OR l.slug = $${params.length}
  )`);
}
```

The query also includes:
- Farmer's own district prices
- Nearest warehouse hub prices
- National reference prices (Ulimi National)

## Benefits

### 1. **Data Relevance**
Farmers see only prices that are actionable and relevant to their location.

### 2. **Improved User Experience**
- No confusion from seeing prices from distant markets
- Focused information for better decision-making
- Faster queries (smaller result sets)

### 3. **Security & Privacy**
- Farmers cannot probe prices from other districts
- Reduces potential for data harvesting
- Aligns with data access best practices

### 4. **Scalability**
- Reduced database load (district-scoped queries)
- Better index utilization
- Efficient caching per district

## Example Use Cases

### Case 1: Farmer in Kasungu
```javascript
// Farmer registered with district: "Kasungu"
GET /api/market/prices

// Returns prices from:
// - Kasungu district markets
// - Lilongwe (nearest warehouse hub)
// - Ulimi National (reference prices)
```

### Case 2: Farmer in Mzuzu
```javascript
// Farmer registered with district: "Mzuzu"
GET /api/market/trends?commodity=maize

// Returns trends from:
// - Mzuzu district markets
// - Mzuzu (itself is a hub)
// - Ulimi National
```

### Case 3: Unauthenticated Access
```javascript
// No farmer authentication
GET /api/market/prices?district=Blantyre

// Returns prices from Blantyre
// (Public access allowed with explicit district)
```

### Case 4: Staff Member
```javascript
// Staff user can view any district
GET /api/staff/market/prices?district=Lilongwe
GET /api/staff/market/prices?district=Kasungu
GET /api/staff/market/prices  // All districts
```

## Testing

### Manual Testing
1. **Login as farmer** from Kasungu:
   ```bash
   curl -X POST http://localhost:3000/api/farmers/login \
     -H "Content-Type: application/json" \
     -d '{"phone": "265888123456", "pin": "1234"}'
   ```

2. **Get market prices** (should return only Kasungu prices):
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/market/prices
   ```

3. **Try to access other district** (should still return Kasungu):
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/market/prices?district=Lilongwe
   ```

### Expected Results
- Authenticated farmer sees **only their district**
- Query parameter `?district=X` is **ignored** when farmer is logged in
- Staff can see **all districts** via staff endpoints

## Database Schema

The `farmers` table includes the district field:
```sql
CREATE TABLE IF NOT EXISTS farmers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,  -- Used for filtering market prices
  epa TEXT,
  region TEXT NOT NULL,
  ...
);
```

Market locations are also district-tagged:
```sql
CREATE TABLE IF NOT EXISTS market_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,  -- Used for matching farmer's district
  region TEXT,
  ...
);
```

## Deployment

### Deployed
- ✅ **Date**: September 9, 2026
- ✅ **Environment**: Production (zammunda.com)
- ✅ **Version**: Commit `4b8dac4`
- ✅ **Status**: Live and operational

### Rollback Plan
If needed, revert to previous commit:
```bash
cd /opt/nzeru-za-alimi
git checkout 2624ff9
systemctl restart nzeru-za-alimi
```

## Future Enhancements

1. **Multi-district Support**
   - Allow farmers to view prices from multiple saved districts
   - Useful for farmers with land in multiple districts

2. **Regional Aggregation**
   - Show regional average prices
   - Compare farmer's district to regional averages

3. **Custom Radius**
   - Allow farmers to set a distance radius (e.g., 50km)
   - Show prices from markets within that radius

4. **Price Alerts**
   - Notify farmers when prices in their district cross thresholds
   - Already implemented: `/api/market/alerts`

## Related Files

- `server/src/app.js` - API endpoint handlers
- `server/src/market/store.js` - Database queries with district filtering
- `server/src/market/locations.js` - District and hub mapping
- `server/src/auth.js` - Farmer authentication

## Documentation

- See `README.md` for API documentation
- See `/api-docs` (Swagger UI) for interactive API testing
- See `docs/DEPLOYMENT.md` for deployment procedures

---

**Status**: ✅ **Implemented and Deployed**  
**Last Updated**: September 9, 2026
