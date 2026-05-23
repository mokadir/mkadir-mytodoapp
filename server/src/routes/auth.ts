import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../lib/jwt";
import { authenticate } from "../middleware/auth";
import { config } from "../config";

const router = Router();

// ─── Rate Limiter for Auth Endpoints ───────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later" },
});

// Apply rate limiter to all auth routes
router.use(authLimiter);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Name cannot be only whitespace"),
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.toLowerCase().trim()),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be 128 characters or less"),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: "A user with this email already exists" });
      return;
    }

    // Hash password with cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash },
    });

    // Generate tokens
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        expiresAt,
        userId: user.id,
      },
    });

    res.status(201).json({
      message: "User registered successfully",
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[REGISTER ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Verify password (constant-time comparison via bcrypt)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Generate tokens
    const payload = { userId: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        expiresAt,
        userId: user.id,
      },
    });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[LOGIN ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Verify token signature
    const decoded = verifyToken(refreshToken);

    // Check if token exists in DB and is not expired
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      res.status(401).json({ message: "Invalid refresh token" });
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }

    // Rotate: delete old, issue new
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const payload = { userId: decoded.userId, email: decoded.email };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        expiresAt,
        userId: decoded.userId,
      },
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      // Delete the refresh token from DB (token invalidation)
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("[LOGOUT ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("[ME ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
