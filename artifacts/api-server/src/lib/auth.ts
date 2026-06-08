import type { Request, Response, NextFunction } from "express";
import { usersTable } from "@workspace/db";

type DbUser = typeof usersTable.$inferSelect;

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated?.() && req.user) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
};

export const getCurrentUser = async (req: Request): Promise<DbUser> => {
  const user = req.user as DbUser | undefined;
  if (!user) throw new Error("No authenticated user on request");
  return user;
};
