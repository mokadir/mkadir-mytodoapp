import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { execSync } from "child_process";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";

const app = express();

// ─── Trust Proxy (for rate limiting behind reverse proxies) ────────────────────
app.set("trust proxy", config.isProduction ? 1 : 0);

// ─── Security Headers (Helmet) ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: config.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (config.cors.origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin "${origin}" not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  })
);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── General Rate Limiter ──────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

app.use("/api", generalLimiter);

// ─── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── Serve Client Static Files (in production) ────────────────────────────────
if (config.isProduction) {
  const clientDist = path.resolve(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));

  // SPA fallback: serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database Migration ───────────────────────────────────────────────────────
async function runMigrations() {
  // __dirname is server/dist/ after compilation, so server root is one level up
  const serverRoot = path.resolve(__dirname, "..");
  const prismaCli = path.resolve(serverRoot, "node_modules", ".bin", "prisma");
  const dataDir = path.resolve(serverRoot, "prisma", "data");

  // Ensure the data directory exists with proper permissions
  try {
    const { mkdirSync } = await import("fs");
    mkdirSync(dataDir, { recursive: true, mode: 0o755 });
    console.log(`Data directory ensured at: ${dataDir}`);
  } catch (dirError) {
    console.error("Failed to create data directory:", dirError);
    process.exit(1);
  }

  try {
    console.log("Running database migrations...");
    execSync(`"${prismaCli}" migrate deploy`, {
      cwd: serverRoot,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    console.log("Database migrations completed successfully");
  } catch (error) {
    console.error("Migration failed, attempting db push as fallback:", error);
    try {
      execSync(`"${prismaCli}" db push --accept-data-loss`, {
        cwd: serverRoot,
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      });
      console.log("Database push completed");
    } catch (pushError) {
      console.error("Database initialization failed:", pushError);
      process.exit(1);
    }
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start() {
  await runMigrations();

  app.listen(config.port, () => {
    console.log(`
  ╔══════════════════════════════════════════════╗
  ║  Todo App API Server                         ║
  ║  ─────────────────────────────               ║
  ║  Port:    ${String(config.port).padEnd(33)}║
  ║  Env:     ${config.nodeEnv.padEnd(33)}║
  ║  Health:  http://localhost:${config.port}/api/health  ║
  ╚══════════════════════════════════════════════╝
    `);
  });
}

start();

export default app;
