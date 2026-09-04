import { Role } from "@prisma/client";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError, asyncHandler, paramId, validateBody } from "../lib/utils.js";
import { requireAuth, requireRole, signToken } from "../middleware/auth.js";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const promoteSchema = z.object({
  role: z.nativeEnum(Role),
});

export const authRouter = Router();

authRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body as z.infer<typeof signupSchema>;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: Role.USER },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ user, token });
  }),
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res.json({ user });
  }),
);

authRouter.patch(
  "/users/:id/role",
  requireAuth,
  requireRole(Role.ADMIN),
  validateBody(promoteSchema),
  asyncHandler(async (req, res) => {
    const { role } = req.body as z.infer<typeof promoteSchema>;
    const userId = paramId(req.params.id);

    if (userId === req.user!.userId && role !== Role.ADMIN) {
      throw new AppError(400, "Admins cannot demote themselves");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(404, "User not found");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.json({ user: updated });
  }),
);
