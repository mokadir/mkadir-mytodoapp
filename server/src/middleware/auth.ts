import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthPayload {
  userId: string;
  email: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // Check for Bearer scheme
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({ message: "Invalid authorization header format. Use: Bearer <token>" });
    return;
  }

  const token = parts[1];

  if (!token || token.length < 10) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TokenExpiredError"
        ? "Token expired"
        : "Invalid or malformed token";
    res.status(401).json({ message });
  }
};
