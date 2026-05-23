import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

// All project routes require authentication
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Project name cannot be only whitespace"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #FF0000)")
    .optional()
    .default("#3B82F6"),
});

const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Project name cannot be only whitespace")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #FF0000)")
    .optional(),
});

const reorderProjectsSchema = z.object({
  orderedIds: z.array(z.string()).min(1, "At least one project ID is required"),
});

// ─── GET /api/projects ────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.userId },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { todos: true },
        },
      },
    });

    res.json({ projects });
  } catch (error) {
    console.error("[GET PROJECTS ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/projects ───────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color } = createProjectSchema.parse(req.body);

    // Get the highest sortOrder for this user
    const lastProject = await prisma.project.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { sortOrder: "desc" },
    });

    const project = await prisma.project.create({
      data: {
        name,
        color,
        sortOrder: (lastProject?.sortOrder ?? -1) + 1,
        userId: req.user!.userId,
      },
    });

    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    // Handle unique constraint violation
    if ((error as any)?.code === "P2002") {
      res.status(409).json({ message: "A project with this name already exists" });
      return;
    }
    console.error("[CREATE PROJECT ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/projects/reorder ────────────────────────────────────────────────

router.put("/reorder", async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderedIds } = reorderProjectsSchema.parse(req.body);

    const updates = orderedIds.map((id, index) =>
      prisma.project.updateMany({
        where: { id, userId: req.user!.userId },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);

    res.json({ message: "Reordered successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[REORDER PROJECTS ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────

router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const data = updateProjectSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id },
      data,
    });

    res.json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    if ((error as any)?.code === "P2002") {
      res.status(409).json({ message: "A project with this name already exists" });
      return;
    }
    console.error("[UPDATE PROJECT ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    await prisma.project.delete({ where: { id } });

    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("[DELETE PROJECT ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
