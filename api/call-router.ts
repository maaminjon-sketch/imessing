import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { calls } from "../db/schema";

export const callRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const callList = await db.query.calls.findMany({
      where: or(eq(calls.callerId, userId), eq(calls.calleeId, userId)),
      orderBy: [desc(calls.startedAt)],
      limit: 50,
      with: {
        caller: true,
        callee: true,
      },
    });

    return callList.map((c: typeof calls.$inferSelect & { caller: typeof import("../db/schema").users.$inferSelect | null; callee: typeof import("../db/schema").users.$inferSelect | null }) => ({
      id: c.id,
      callerId: c.callerId,
      calleeId: c.calleeId,
      callerName: c.caller?.displayName || "Unknown",
      calleeName: c.callee?.displayName || "Unknown",
      callerAvatar: c.caller?.avatar,
      calleeAvatar: c.callee?.avatar,
      status: c.status,
      duration: c.duration,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      isOutgoing: c.callerId === userId,
    }));
  }),

  create: authedQuery
    .input(z.object({ calleeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const result = await db.insert(calls).values({
        callerId: ctx.user.id,
        calleeId: input.calleeId,
        status: "missed",
        startedAt: new Date(),
      });

      return { callId: Number(result[0].insertId) };
    }),

  update: authedQuery
    .input(
      z.object({
        callId: z.number(),
        status: z.enum(["answered", "rejected", "ended"]),
        duration: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      await db
        .update(calls)
        .set({
          status: input.status,
          ...(input.duration && { duration: input.duration }),
          ...(input.status === "ended" && { endedAt: new Date() }),
        })
        .where(eq(calls.id, input.callId));

      return { success: true };
    }),
});
