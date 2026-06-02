import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkId = clerkId;
  next();
};

export const getOrCreateUser = async (clerkId: string, fallbackName?: string) => {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing[0]) return existing[0];

  const username = `user_${clerkId.slice(-8)}`;
  const name = fallbackName || "Filmmaker";
  const [user] = await db.insert(usersTable).values({ clerkId, username, name, profession: "Other" }).returning();
  return user;
};

export const getCurrentUser = async (req: Request) => {
  const clerkId = (req as any).clerkId as string;
  return getOrCreateUser(clerkId);
};
