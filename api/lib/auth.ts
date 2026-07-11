import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { users, userSessions } from "../../db/schema";

const JWT_SECRET = process.env.APP_SECRET || "imessing-secret-key-2024";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET, { clockTolerance: 60 }) as { userId: number };
  } catch {
    return null;
  }
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken(userId);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await getDb().insert(userSessions).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

export async function authenticateUser(username: string, password: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  // Update online status
  await db.update(users).set({
    isOnline: true,
    lastSeen: new Date(),
  }).where(eq(users.id, user.id));

  return user;
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
  });

  return user || null;
}

export async function logoutUser(token: string) {
  const db = getDb();
  await db.delete(userSessions).where(eq(userSessions.token, token));
}
