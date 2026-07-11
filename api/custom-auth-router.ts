import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users } from "../db/schema";
import {
  hashPassword,
  authenticateUser,
  createSession,
  logoutUser,
} from "./lib/auth";
import { ErrorMessages } from "../contracts/constants";

export const customAuthRouter = createRouter({
  register: publicQuery
    .input(
      z.object({
        username: z
          .string()
          .min(3, "Username must be at least 3 characters")
          .max(50, "Username must be at most 50 characters")
          .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
        displayName: z
          .string()
          .min(1, "Display name is required")
          .max(100, "Display name must be at most 100 characters"),
        password: z
          .string()
          .min(6, "Password must be at least 6 characters")
          .max(100, "Password must be at most 100 characters"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Check if username is taken
      const existing = await db.query.users.findFirst({
        where: eq(users.username, input.username),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: ErrorMessages.usernameTaken,
        });
      }

      const passwordHash = await hashPassword(input.password);

      const result = await db.insert(users).values({
        username: input.username,
        displayName: input.displayName,
        passwordHash,
        isOnline: true,
        lastSeen: new Date(),
      });

      const userId = Number(result[0].insertId);
      const token = await createSession(userId);

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      return {
        token,
        user: {
          id: user!.id,
          username: user!.username,
          displayName: user!.displayName,
          avatar: user!.avatar,
          status: user!.status,
          isOnline: user!.isOnline,
        },
      };
    }),

  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await authenticateUser(input.username, input.password);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: ErrorMessages.invalidCredentials,
        });
      }

      const token = await createSession(user.id);

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          status: user.status,
          isOnline: user.isOnline,
        },
      };
    }),

  me: authedQuery.query((opts) => {
    const { user } = opts.ctx;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      name: user.displayName || user.username,
      avatar: user.avatar,
      status: user.status,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      role: user.role,
      createdAt: user.createdAt,
    };
  }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    if (ctx.token) {
      await logoutUser(ctx.token);
    }
    return { success: true };
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        displayName: z.string().min(1).max(100).optional(),
        status: z.string().max(255).optional(),
        avatar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({
          ...(input.displayName && { displayName: input.displayName }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.avatar !== undefined && { avatar: input.avatar }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  searchUsers: authedQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const allUsers = await db.query.users.findMany({
        limit: 50,
      });

      const filtered = allUsers.filter(
        (u: typeof users.$inferSelect) =>
          u.id !== ctx.user.id &&
          (u.username.toLowerCase().includes(input.query.toLowerCase()) ||
            u.displayName.toLowerCase().includes(input.query.toLowerCase()))
      );

      return filtered.map((u: typeof users.$inferSelect) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        status: u.status,
        isOnline: u.isOnline,
      }));
    }),
});
