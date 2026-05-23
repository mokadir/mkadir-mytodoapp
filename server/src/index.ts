import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
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

export default app;
