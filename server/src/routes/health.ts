import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * GET /api/health
 * Basic health check endpoint.
 * Returns server status and database connectivity.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "connected",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: "disconnected",
    });
  }
});

export default router;
