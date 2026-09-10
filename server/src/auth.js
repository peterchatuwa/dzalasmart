import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { publicFarmer, publicStaff } from "./util.js";

export function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

export function pinMatches(pin, pinHash) {
  return bcrypt.compareSync(pin, pinHash);
}

export function signFarmerToken(farmer, secret) {
  return jwt.sign({ sub: farmer.id, phone: farmer.phone, code: farmer.code, role: "farmer" }, secret, {
    expiresIn: "30d",
  });
}

export function signStaffToken(staff, secret) {
  return jwt.sign({ sub: staff.id, phone: staff.phone, role: "staff", staffRole: staff.role }, secret, {
    expiresIn: "30d",
  });
}

export async function readOptionalFarmer(db, secret, req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret);
    if (payload.role && payload.role !== "farmer") return null;
    const farmer = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(payload.sub);
    return farmer ? publicFarmer(farmer) : null;
  } catch {
    return null;
  }
}

export function requireFarmer(db, secret) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    try {
      const payload = jwt.verify(token, secret);
      if (payload.role && payload.role !== "farmer") {
        res.status(403).json({ error: "Farmer sign-in required" });
        return;
      }
      const farmer = await db.prepare("SELECT * FROM farmers WHERE id = ?").get(payload.sub);
      if (!farmer) {
        res.status(401).json({ error: "Account not found" });
        return;
      }
      req.farmer = publicFarmer(farmer);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired session" });
    }
  };
}

export function requireStaff(db, secret) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Staff sign-in required" });
      return;
    }
    try {
      const payload = jwt.verify(token, secret);
      if (payload.role !== "staff") {
        res.status(403).json({ error: "Staff sign-in required" });
        return;
      }
      const staff = await db.prepare("SELECT * FROM staff WHERE id = ?").get(payload.sub);
      if (!staff) {
        res.status(401).json({ error: "Account not found" });
        return;
      }
      req.staff = publicStaff(staff);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired session" });
    }
  };
}

export function requireStaffRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.staff?.role)) {
      const who = roles.join(" or ");
      res.status(403).json({ error: `Only ${who} staff can do this` });
      return;
    }
    next();
  };
}

export function requireCooperative() {
  return requireStaffRole("cooperative");
}
