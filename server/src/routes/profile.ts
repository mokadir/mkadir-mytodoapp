import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Name cannot be only whitespace")
    .optional(),
  bio: z
    .string()
    .max(500, "Bio must be 500 characters or less")
    .optional(),
  avatarUrl: z
    .string()
    .url("Must be a valid URL")
    .max(500, "URL must be 500 characters or less")
    .optional()
    .nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters")
    .max(128, "New password must be 128 characters or less"),
});

// ─── GET /api/profile ─────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            todos: true,
            projects: true,
            tags: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("[GET PROFILE ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────────

router.put("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user, message: "Profile updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[UPDATE PROFILE ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/profile/password ────────────────────────────────────────────────

router.put("/password", async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Verify current password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const bcrypt = await import("bcryptjs");
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    // Hash and update new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password: passwordHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[CHANGE PASSWORD ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
