import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { AuthPayload } from "../middleware/auth";

/**
 * Generate an access token (short-lived).
 */
export const generateAccessToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn as SignOptions["expiresIn"],
    issuer: "todo-app",
    subject: payload.userId,
  });
};

/**
 * Generate a refresh token (long-lived).
 */
export const generateRefreshToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as SignOptions["expiresIn"],
    issuer: "todo-app",
    subject: payload.userId,
  });
};

/**
 * Verify and decode any JWT token.
 * Throws if the token is invalid, expired, or tampered with.
 */
export const verifyToken = (token: string): AuthPayload => {
  return jwt.verify(token, config.jwt.secret, {
    issuer: "todo-app",
  }) as AuthPayload;
};
