import path from "node:path";
import express from "express";
import cors from "cors";
import { requireFarmer, requireStaff } from "./auth.js";
import { farmerStatus, getFarmerById, listFarmerSummaries, loginFarmer, logStage, registerFarmer } from "./farmers.js";
import { listDistricts } from "./places.js";
import { STAGES } from "./stages.js";
import { loginStaff } from "./staff.js";
import { handleUssd } from "./ussd.js";

export function createApp(db, options = {}) {
  const jwtSecret = options.jwtSecret || "local-dev-secret";
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "dzalasmart" });
  });

  app.get("/api/stages", (_req, res) => {
    res.json({ stages: STAGES });
  });

  app.get("/api/districts", (_req, res) => {
    res.json({ districts: listDistricts() });
  });

  app.post("/api/farmers/register", (req, res, next) => {
    try {
      res.status(201).json(registerFarmer(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/login", (req, res, next) => {
    try {
      res.json(loginFarmer(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/farmers/me", requireFarmer(db, jwtSecret), (req, res) => {
    res.json({ farmer: req.farmer });
  });

  app.get("/api/farmers/me/status", requireFarmer(db, jwtSecret), (req, res, next) => {
    try {
      const row = db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.json(farmerStatus(db, row));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/farmers/me/events", requireFarmer(db, jwtSecret), (req, res, next) => {
    try {
      const row = db.prepare("SELECT * FROM farmers WHERE id = ?").get(req.farmer.id);
      res.status(201).json(logStage(db, row, { ...req.body, channel: req.body?.channel || "mobile" }));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/staff/login", (req, res, next) => {
    try {
      res.json(loginStaff(db, req.body || {}, jwtSecret));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/me", requireStaff(db, jwtSecret), (req, res) => {
    res.json({ staff: req.staff });
  });

  app.get("/api/staff/farmers", requireStaff(db, jwtSecret), (_req, res, next) => {
    try {
      res.json({ farmers: listFarmerSummaries(db) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/staff/farmers/:id", requireStaff(db, jwtSecret), (req, res, next) => {
    try {
      const row = getFarmerById(db, req.params.id);
      if (!row) {
        res.status(404).json({ error: "Farmer not found" });
        return;
      }
      res.json(farmerStatus(db, row));
    } catch (error) {
      next(error);
    }
  });

  app.post("/ussd", (req, res, next) => {
    try {
      const reply = handleUssd(db, req.body || {});
      res.type("text/plain").send(reply);
    } catch (error) {
      next(error);
    }
  });

  if (options.frontendDir) {
    app.get("/staff", (_req, res) => {
      res.sendFile(path.join(options.frontendDir, "staff.html"));
    });
    app.use(express.static(options.frontendDir));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api") || req.path === "/ussd" || req.path === "/health") {
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
