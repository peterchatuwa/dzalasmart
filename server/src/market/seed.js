import { REGION_DISTRICTS, DISTRICT_COORDS, regionForDistrict } from "../places.js";
import { MARKET_COMMODITIES, MARKET_SOURCES } from "./catalog.js";
import { districtSlug, MAJOR_TRADING_CENTRES, ensureTradingCentre } from "./locations.js";
import { seedLogisticsRoutes } from "./logistics.js";

export async function seedMarketCatalog(db) {
  const now = Date.now();
  for (const source of MARKET_SOURCES) {
    await db.prepare(`
      INSERT INTO market_sources (id, slug, name, kind, url, enabled, updated_at)
      VALUES (@id, @slug, @name, @kind, @url, 1, @updated_at)
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        url = EXCLUDED.url,
        updated_at = EXCLUDED.updated_at
    `).run({
      id: crypto.randomUUID(),
      slug: source.slug,
      name: source.name,
      kind: source.kind,
      url: source.url,
      updated_at: now,
    });
  }

  for (const commodity of MARKET_COMMODITIES) {
    await db.prepare(`
      INSERT INTO market_commodities (id, slug, name, aliases_json, active)
      VALUES (@id, @slug, @name, @aliases_json, 1)
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        aliases_json = EXCLUDED.aliases_json
    `).run({
      id: crypto.randomUUID(),
      slug: commodity.slug,
      name: commodity.name,
      aliases_json: JSON.stringify(commodity.aliases),
    });
  }

  await db.prepare(`
    INSERT INTO market_locations (id, slug, name, type, parent_id, region, district, lat, lon)
    VALUES (@id, @slug, @name, @type, @parent_id, @region, @district, @lat, @lon)
    ON CONFLICT(slug) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      parent_id = EXCLUDED.parent_id,
      region = EXCLUDED.region,
      district = EXCLUDED.district,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon
  `).run({
    id: "loc-ulimi-national",
    slug: "ulimi-national",
    name: "Malawi (Ulimi platform)",
    type: "market",
    parent_id: null,
    region: null,
    district: null,
    lat: -13.98,
    lon: 33.78,
  });

  for (const [region, districts] of Object.entries(REGION_DISTRICTS)) {
    const regionSlug = region.toLowerCase().replace(/[^a-z]+/g, "-");
    const regionId = `loc-region-${regionSlug}`;
    await db.prepare(`
      INSERT INTO market_locations (id, slug, name, type, parent_id, region, district, lat, lon)
      VALUES (@id, @slug, @name, 'region', NULL, @region, NULL, NULL, NULL)
      ON CONFLICT(slug) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region
    `).run({
      id: regionId,
      slug: regionSlug,
      name: region,
      region,
    });

    for (const district of districts) {
      const coords = DISTRICT_COORDS[district] || [-13.5, 34.0];
      const slug = districtSlug(district);
      await db.prepare(`
        INSERT INTO market_locations (id, slug, name, type, parent_id, region, district, lat, lon)
        VALUES (@id, @slug, @name, 'district', @parent_id, @region, @district, @lat, @lon)
        ON CONFLICT(slug) DO UPDATE SET
          name = EXCLUDED.name,
          parent_id = EXCLUDED.parent_id,
          region = EXCLUDED.region,
          district = EXCLUDED.district,
          lat = EXCLUDED.lat,
          lon = EXCLUDED.lon
      `).run({
        id: `loc-district-${slug}`,
        slug,
        name: district,
        parent_id: regionId,
        region: regionForDistrict(district) || region,
        district,
        lat: coords[0],
        lon: coords[1],
      });
    }
  }

  for (const hub of ["Lilongwe", "Kasungu", "Mchinji"]) {
    const hubSlug = `warehouse-${districtSlug(hub)}`;
    await db.prepare(`
      INSERT INTO market_locations (id, slug, name, type, parent_id, region, district, lat, lon)
      VALUES (@id, @slug, @name, 'market', @parent_id, @region, @district, @lat, @lon)
      ON CONFLICT(slug) DO UPDATE SET
        name = EXCLUDED.name,
        district = EXCLUDED.district,
        lat = EXCLUDED.lat,
        lon = EXCLUDED.lon
    `).run({
      id: `loc-${hubSlug}`,
      slug: hubSlug,
      name: `${hub} warehouse`,
      parent_id: `loc-district-${districtSlug(hub)}`,
      region: regionForDistrict(hub),
      district: hub,
      lat: DISTRICT_COORDS[hub]?.[0] ?? null,
      lon: DISTRICT_COORDS[hub]?.[1] ?? null,
    });
  }

  for (const centre of MAJOR_TRADING_CENTRES) {
    await ensureTradingCentre(db, centre);
  }

  await seedLogisticsRoutes(db);
}

export async function sourceIdBySlug(db, slug) {
  return (await db.prepare("SELECT id FROM market_sources WHERE slug = ?").get(slug))?.id || null;
}

export async function commodityIdBySlug(db, slug) {
  return (await db.prepare("SELECT id FROM market_commodities WHERE slug = ?").get(slug))?.id || null;
}

export async function locationIdBySlug(db, slug) {
  return (await db.prepare("SELECT id FROM market_locations WHERE slug = ?").get(slug))?.id || null;
}

export async function locationIdForDistrict(db, district) {
  return locationIdBySlug(db, districtSlug(district));
}

export async function warehouseLocationId(db, hub) {
  return locationIdBySlug(db, `warehouse-${districtSlug(hub)}`);
}
