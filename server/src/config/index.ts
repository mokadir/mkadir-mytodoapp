import dotenv from "dotenv";
import path from "path";

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: (process.env.NODE_ENV || "development") === "production",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  jwt: {
    secret: process.env.JWT_SECRET || "fallback-dev-secret",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGIN || "http://localhost:5173"),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxAuth: parseInt(process.env.RATE_LIMIT_MAX_AUTH || "10", 10),
    maxGeneral: parseInt(process.env.RATE_LIMIT_MAX_GENERAL || "100", 10),
  },
} as const;

// In production, require a strong JWT secret
if (config.isProduction) {
  const secret = config.jwt.secret;
  if (!secret || secret.length < 32 || secret === "change-me-to-a-secure-random-string-in-production") {
    console.error(
      "\n  ⚠  WARNING: JWT_SECRET is too weak or still using the default value.\n" +
      "     Generate a strong secret with: openssl rand -base64 64\n"
    );
  }
}
