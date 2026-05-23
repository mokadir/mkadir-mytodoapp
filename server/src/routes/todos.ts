import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

// All todo routes require authentication
router.use(authenticate);

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createTodoSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Title cannot be only whitespace"),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  dueDate: z
    .string()
    .datetime("Invalid date format")
    .optional()
    .nullable(),
  tagIds: z.array(z.string()).max(20, "Maximum 20 tags per todo").optional(),
  projectId: z.string().optional().nullable(),
});

const updateTodoSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less")
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, "Title cannot be only whitespace")
    .optional(),
  completed: z.boolean().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z
    .string()
    .datetime("Invalid date format")
    .optional()
    .nullable(),
  tagIds: z.array(z.string()).max(20, "Maximum 20 tags per todo").optional(),
  projectId: z.string().optional().nullable(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1, "At least one todo ID is required"),
});

const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(50, "Tag name must be 50 characters or less")
    .transform((s) => s.trim().toLowerCase())
    .refine((s) => s.length > 0, "Tag name cannot be only whitespace"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #FF0000)")
    .optional()
    .default("#3B82F6"),
});

// ─── GET /api/todos ───────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const todos = await prisma.todo.findMany({
      where: { userId: req.user!.userId },
      orderBy: { sortOrder: "asc" },
      include: { tags: true },
    });
    res.json({ todos });
  } catch (error) {
    console.error("[GET TODOS ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/todos ──────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, priority, dueDate, tagIds, projectId } = createTodoSchema.parse(req.body);

    // Get the highest sortOrder for this user to append at the end
    const lastTodo = await prisma.todo.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { sortOrder: "desc" },
    });

    const todo = await prisma.todo.create({
      data: {
        title,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: (lastTodo?.sortOrder ?? -1) + 1,
        userId: req.user!.userId,
        projectId: projectId || null,
        tags: tagIds && tagIds.length > 0
          ? { connect: tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { tags: true },
    });

    res.status(201).json({ todo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[CREATE TODO ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/todos/reorder ───────────────────────────────────────────────────

router.put("/reorder", async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderedIds } = reorderSchema.parse(req.body);

    // Update each todo's sortOrder based on its position in the array
    const updates = orderedIds.map((id, index) =>
      prisma.todo.updateMany({
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
    console.error("[REORDER TODOS ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── PUT /api/todos/:id ───────────────────────────────────────────────────────

router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ message: "Todo not found" });
      return;
    }

    const data = updateTodoSchema.parse(req.body);

    // Separate tagIds and projectId from other fields
    const { tagIds, projectId, ...todoData } = data;

    const todo = await prisma.todo.update({
      where: { id },
      data: {
        ...todoData,
        dueDate: todoData.dueDate !== undefined
          ? (todoData.dueDate ? new Date(todoData.dueDate) : null)
          : undefined,
        projectId: projectId !== undefined ? projectId : undefined,
        tags: tagIds !== undefined
          ? { set: tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { tags: true },
    });

    res.json({ todo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    console.error("[UPDATE TODO ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DELETE /api/todos/:id ────────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Verify ownership
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ message: "Todo not found" });
      return;
    }

    await prisma.todo.delete({ where: { id } });

    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    console.error("[DELETE TODO ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── GET /api/todos/tags ──────────────────────────────────────────────────────

router.get("/tags/list", async (req: Request, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.user!.userId },
      orderBy: { name: "asc" },
    });
    res.json({ tags });
  } catch (error) {
    console.error("[GET TAGS ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── POST /api/todos/tags ─────────────────────────────────────────────────────

router.post("/tags", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color } = createTagSchema.parse(req.body);

    const tag = await prisma.tag.create({
      data: {
        name,
        color,
        userId: req.user!.userId,
      },
    });

    res.status(201).json({ tag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "Validation error", errors: error.errors });
      return;
    }
    // Handle unique constraint violation
    if ((error as any)?.code === "P2002") {
      res.status(409).json({ message: "A tag with this name already exists" });
      return;
    }
    console.error("[CREATE TAG ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── DELETE /api/todos/tags/:id ───────────────────────────────────────────────

router.delete("/tags/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.tag.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      res.status(404).json({ message: "Tag not found" });
      return;
    }

    await prisma.tag.delete({ where: { id } });

    res.json({ message: "Tag deleted successfully" });
  } catch (error) {
    console.error("[DELETE TAG ERROR]", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
