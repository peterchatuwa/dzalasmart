import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", ".env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateConfig() {
  const errors = [];

  // JWT_SECRET validation
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push("JWT_SECRET is not set");
  } else if (jwtSecret === "local-dev-secret") {
    if (process.env.NODE_ENV === "production") {
      errors.push("JWT_SECRET must be changed from default in production");
    } else {
      console.warn("⚠️  Warning: Using default JWT_SECRET. Set a strong secret in .env before deploying.");
    }
  } else if (jwtSecret.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters");
  }

  // Database URL validation for production
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required in production");
  }

  // Port validation
  const port = process.env.PORT;
  if (port && (isNaN(port) || Number(port) < 1 || Number(port) > 65535)) {
    errors.push("PORT must be a valid port number (1-65535)");
  }

  if (errors.length > 0) {
    console.error("❌ Configuration validation failed:");
    errors.forEach((err) => console.error(`   - ${err}`));
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid configuration for production");
    }
  }
}

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "local-dev-secret",
  databaseUrl: process.env.DATABASE_URL || ":memory:",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
};

validateConfig();

export { required, validateConfig };
