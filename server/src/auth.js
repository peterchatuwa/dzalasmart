import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { publicFarmer } from "./util.js";

export function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

export function pinMatches(pin, pinHash) {
  return bcrypt.compareSync(pin, pinHash);
}

export function signFarmerToken(farmer, secret) {
  return jwt.sign(
    { sub: farmer.id, phone: farmer.phone, code: farmer.code },
    secret,
    { expiresIn: "30d" }
  );
}

export function requireFarmer(db, secret) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "Sign in required" });
      return;
    }
    try {
      const payload = jwt.verify(token, secret);
      const farmer = db.prepare("SELECT * FROM farmers WHERE id = ?").get(payload.sub);
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
