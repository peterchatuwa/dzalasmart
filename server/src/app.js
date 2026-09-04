import path from "node:path";
import express from "express";
import cors from "cors";
import { advisorMeta, askAdvisor, listPestReports, logPestReport } from "./advisor.js";
import { readOptionalFarmer, requireCooperative, requireFarmer, requireStaff, requireStaffRole } from "./auth.js";
import { farmerStatus, getFarmerById, listFarmerSummaries, loginFarmer, logStage, registerFarmer } from "./farmers.js";
import { contractMonitor, listFloors, recordOffer, setFloor } from "./floors.js";
import { APP_NAME, APP_SLUG } from "./brand.js";
import { listDistricts } from "./places.js";
import { STAGES } from "./stages.js";
import { loginStaff } from "./staff.js";
import { handleUssd } from "./ussd.js";
import { visitQueue } from "./visits.js";
import { nationalViewWithWeather } from "./ndvi.js";
import { getFarmPlan, saveFarmPlan } from "./plan.js";
import { getFarmerPlot, saveFarmerPlot } from "./plots.js";
import { GRAIN_CROPS, acceptWarehouseLoan, recordIntake, warehouseSummary, withReceipts } from "./warehouse.js";
import { districtAlerts, fetchDistrictWeather, publicWeather } from "./weather.js";
import { marketPayload, marketPricesPayload, marketHistoryPayload, marketComparePayload, marketSourcesComparePayload, marketOpportunitiesPayload, marketTrendsPayload, marketExportPayload, refreshMarketCache, getMarketRows, getMarketMeta, recordManualObservation, importMarketCsv, refreshAllSources } from "./market.js";

export function createApp(db, options = {}) {
  const jwtSecret = options.jwtSecret || "local-dev-secret";
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: APP_SLUG, name: APP_NAME, database: "postgresql" });
  });

  app.get("/api/stages", (_req, res) => {
    res.json({ stages: STAGES });
  });

  app.get("/api/districts", (_req, res) => {
    res.json({ districts: listDistricts() });
  });

  app.get("/api/market", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim() || null;
      res.json(await marketPayload(db, { district }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/prices", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim() || null;
      res.json(await marketPricesPayload(db, {
        district: district || undefined,
        region: String(req.query.region || "").trim() || undefined,
        commoditySlug: String(req.query.commodity || req.query.commoditySlug || "").trim() || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        refresh: req.query.refresh === "1",
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/history", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim() || null;
      res.json(await marketHistoryPayload(db, {
        district: district || undefined,
        commoditySlug: String(req.query.commodity || req.query.commoditySlug || "").trim() || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        locationSlug: String(req.query.location || req.query.locationSlug || "").trim() || undefined,
        days: Number(req.query.days) || 30,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/compare", async (req, res, next) => {
    try {
      const commodity = String(req.query.commodity || req.query.commoditySlug || "maize").trim();
      res.json(await marketComparePayload(db, {
        commodity,
        districts: String(req.query.districts || "").trim() || undefined,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/sources/compare", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim();
      res.json(await marketSourcesComparePayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "maize").trim(),
        district,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/opportunities", async (req, res, next) => {
    try {
      res.json(await marketOpportunitiesPayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "").trim() || undefined,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/trends", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim() || null;
      res.json(await marketTrendsPayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "maize").trim(),
        district: district || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        range: String(req.query.range || "30d").trim(),
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/market/export", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const district = String(req.query.district || farmer?.district || "").trim() || null;
      const payload = await marketExportPayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "").trim() || undefined,
        district: district || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        range: String(req.query.range || "").trim() || undefined,
        days: Number(req.query.days) || undefined,
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
      res.send(payload.csv);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weather", async (req, res, next) => {
    try {
      const district = String(req.query.district || "").trim();
      if (!district) {
        res.status(400).json({ error: "district is required" });
        return;
      }
      const weather = publicWeather(await fetchDistrictWeather(district));
      res.json(weather);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/alerts", async (_req, res, next) => {
    try {
      res.json({ districts: await districtAlerts() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/register", async (req, res, next) => {
    try {
      res.status(201).json(await registerFarmer(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/login", async (req, res, next) => {
    try {
      res.json(await loginFarmer(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/farmers/me", requireFarmer(db, jwtSecret), (req, res) => {
    res.json({ farmer: req.farmer });
  });

  app.get("/api/farmers/me/status", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(await withReceipts(db, await farmerStatus(db, row)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/me/events", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.status(201).json(await withReceipts(db, await logStage(db, row, { ...req.body, channel: req.body?.channel || "mobile" })));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/me/loans", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(await acceptWarehouseLoan(db, row, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/farmers/me/plan", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      await refreshMarketCache(db);
      let weather = null;
      try {
        weather = publicWeather(await fetchDistrictWeather(req.farmer.district));
      } catch {
        weather = null;
      }
      res.json(await getFarmPlan(db, req.farmer, { weather }));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/farmers/me/plan", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      await refreshMarketCache(db);
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(await saveFarmPlan(db, row, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/farmers/me/plot", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(await getFarmerPlot(db, row));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/farmers/me/plot", requireFarmer(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(await saveFarmerPlot(db, row, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/login", async (req, res, next) => {
    try {
      res.json(await loginStaff(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/warehouse/crops", (_req, res) => {
    res.json({
      loanRatio: 0.6,
      crops: GRAIN_CROPS,
      note: "Maize is accepted at or below 13.5% moisture, matching the original warehouse meter rule.",
    });
  });

  app.get("/api/advisor", (_req, res) => {
    res.json(advisorMeta());
  });

  app.post("/api/advisor/ask", async (req, res, next) => {
    try {
      const farmer = await readOptionalFarmer(db, jwtSecret, req);
      const body = req.body || {};
      const result = askAdvisor({
        ...body,
        farmer,
        soil: body.soil || farmer?.soilType,
        nutrient: body.nutrient || farmer?.nutrientStatus,
      });
      if (result.intent === "weather") {
        const district = body.district || farmer?.district;
        if (!district) {
          result.reply = "Tell me your district, or log in so I can use the one on your farm record.";
        } else {
          const wx = publicWeather(await fetchDistrictWeather(district));
          result.reply = `${wx.district} ${wx.alert.toUpperCase()}\nNow ${wx.nowC}°C · rain 3d ${wx.rain3dayMm}mm\n${wx.fieldAdvice}`;
        }
      }
      if (result.intent === "market") {
        await refreshMarketCache(db);
        const district = farmer?.district || body.district || null;
        const meta = getMarketMeta(district);
        const floors = (await listFloors(db)).map((row) => `${row.crop} floor MWK ${row.pricePerKg}/kg`).join("\n");
        const rows = getMarketRows(district).slice(0, 4).map((row) => `${row.crop} ${row.price}`).join("\n");
        const label = meta.live
          ? `LocalBuyEx prices${meta.warehouseHub ? ` · ${meta.warehouseHub} warehouse` : ""}`
          : "Reference prices";
        result.reply = `Ministry floors:\n${floors}\n\n${label}:\n${rows}`;
      }
      if (result.kind === "pest" && farmer) {
        await logPestReport(db, farmer, {
          symptoms: body.text || result.match,
          matchName: result.match,
          channel: body.channel || "mobile",
        });
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/floors", async (_req, res, next) => {
    try {
      res.json({ floors: await listFloors(db) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/me", requireStaff(db, jwtSecret), (req, res) => {
    res.json({ staff: req.staff });
  });

  app.get("/api/staff/warehouse", requireStaff(db, jwtSecret), async (_req, res, next) => {
    try {
      res.json(await warehouseSummary(db));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/warehouse/intake", requireStaff(db, jwtSecret), requireCooperative(), async (req, res, next) => {
    try {
      res.status(201).json(await recordIntake(db, req.staff, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/contracts", requireStaff(db, jwtSecret), async (_req, res, next) => {
    try {
      res.json(await contractMonitor(db));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/contracts", requireStaff(db, jwtSecret), requireStaffRole("cooperative"), async (req, res, next) => {
    try {
      res.status(201).json(await recordOffer(db, req.staff, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/staff/floors", requireStaff(db, jwtSecret), requireStaffRole("ministry"), async (req, res, next) => {
    try {
      res.json(await setFloor(db, req.staff, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/pests", requireStaff(db, jwtSecret), async (_req, res, next) => {
    try {
      res.json({ reports: await listPestReports(db) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/visits", requireStaff(db, jwtSecret), async (req, res, next) => {
    try {
      res.json(await visitQueue(db, req.staff));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/market/sources", requireStaff(db, jwtSecret), async (_req, res, next) => {
    try {
      res.json({ sources: (await marketPricesPayload(db, {})).sources });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/market/observations", requireStaff(db, jwtSecret), requireStaffRole("ministry", "cooperative"), async (req, res, next) => {
    try {
      res.status(201).json(await recordManualObservation(db, req.staff, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/market/import", requireStaff(db, jwtSecret), requireStaffRole("ministry"), async (req, res, next) => {
    try {
      res.status(201).json(await importMarketCsv(db, req.staff, req.body || {}));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/market/export", requireStaff(db, jwtSecret), async (req, res, next) => {
    try {
      const payload = await marketExportPayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "").trim() || undefined,
        district: String(req.query.district || "").trim() || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        range: String(req.query.range || "90d").trim(),
        days: Number(req.query.days) || undefined,
        maxRows: 5000,
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
      res.send(payload.csv);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/market/trends", requireStaff(db, jwtSecret), async (req, res, next) => {
    try {
      res.json(await marketTrendsPayload(db, {
        commodity: String(req.query.commodity || req.query.commoditySlug || "maize").trim(),
        district: String(req.query.district || "").trim() || undefined,
        sourceSlug: String(req.query.source || req.query.sourceSlug || "").trim() || undefined,
        range: String(req.query.range || "90d").trim(),
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/market/refresh", requireStaff(db, jwtSecret), requireStaffRole("ministry"), async (_req, res, next) => {
    try {
      const result = await refreshAllSources(db, true);
      res.json({ ok: true, errors: result.errors || [], sources: result.sources || [] });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/national", requireStaff(db, jwtSecret), async (req, res, next) => {
    try {
      res.json(await nationalViewWithWeather(db, req.staff));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/farmers", requireStaff(db, jwtSecret), async (_req, res, next) => {
    try {
      res.json({ farmers: await listFarmerSummaries(db) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/farmers/:id", requireStaff(db, jwtSecret), async (req, res, next) => {
    try {
      const row = await getFarmerById(db, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Farmer not found" });
        return;
      }
      res.json({
        ...(await withReceipts(db, await farmerStatus(db, row))),
        plot: await getFarmerPlot(db, row),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/ussd", async (req, res, next) => {
    try {
      const reply = await handleUssd(db, req.body || {});
      res.type("text/plain").send(reply);
    } catch (error) {
      next(error);
    }
  });

  if (options.frontendDir) {
    app.get("/staff", (_req, res) => {
      res.sendFile(path.join(options.frontendDir, "staff.html"));
    });
    app.get("/ussd-sim", (_req, res) => {
      res.sendFile(path.join(options.frontendDir, "ussd.html"));
    });
    app.use(express.static(options.frontendDir));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/ussd" || req.path === "/health" || req.path === "/ussd-sim") {
        next();
        return;
      }
      res.sendFile(path.join(options.frontendDir, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: error.message || "Server error" });
  });

  return app;
}
