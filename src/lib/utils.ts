import { NextFunction, Request, Response } from "express";
import { ZodError, ZodTypeAny } from "zod";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

/** Convert 0-based row index to letter labels: 0 -> A, 25 -> Z, 26 -> AA */
export function rowLabel(index: number): string {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export function seatKey(row: string, number: number): string {
  return `${row}${number}`;
}

export function paramId(value: string | string[]): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new AppError(400, "Missing id parameter");
  }
  return id;
}
