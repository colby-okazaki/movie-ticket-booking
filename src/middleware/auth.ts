import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError, asyncHandler } from "../lib/utils.js";

export type AuthPayload = {
  userId: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    try {
      const token = header.slice("Bearer ".length);
      const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
      req.user = { userId: decoded.userId, role: decoded.role };
      next();
    } catch {
      throw new AppError(401, "Invalid or expired token");
    }
  },
);

export function requireRole(...roles: Role[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "Insufficient permissions");
    }
    next();
  });
}
