import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import todosRouter from "./todos";
import profileRouter from "./profile";
import projectsRouter from "./projects";
import subscriptionRouter from "./subscription";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/todos", todosRouter);
router.use("/profile", profileRouter);
router.use("/projects", projectsRouter);
router.use("/subscription", subscriptionRouter);

export default router;
