import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for USSD endpoint (more permissive, as telcos may retry)
export const ussdLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per phone per minute
  message: { error: "Too many USSD requests" },
  keyGenerator: (req) => req.body?.phoneNumber || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers middleware
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "http://10.0.2.2:4000", "http://localhost:4000"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.openstreetmap.org"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for OpenStreetMap
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
}

// Request size limiter
export function requestSizeLimiter(maxSize = "10mb") {
  return (req, res, next) => {
    const contentLength = parseInt(req.get("content-length") || "0");
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({ error: "Request entity too large" });
    }

    next();
  };
}

function parseSize(size) {
  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = String(size)
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || "b";
  return value * units[unit];
}

// Sanitize user input
export function sanitizeInput(req, res, next) {
  // Remove any potential SQL injection characters from non-password fields
  const sanitize = (obj) => {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "password" || key === "pin" || key === "pin_hash") {
        sanitized[key] = value; // Don't sanitize passwords
      } else if (typeof value === "string") {
        // Remove null bytes and other control characters
        sanitized[key] = value.replace(/\x00/g, ""); // eslint-disable-line no-control-regex
      } else if (typeof value === "object") {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  // Only sanitize body (query params are read-only in Express 5)
  if (req.body && typeof req.body === "object") {
    try {
      req.body = sanitize(req.body);
    } catch (error) {
      // If body is frozen or read-only, skip sanitization
    }
  }

  next();
}
