import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { contacts, users } from "../db/schema";

export const contactRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();

    const contactList = await db.query.contacts.findMany({
      where: eq(contacts.userId, ctx.user.id),
      with: { contact: true },
    });

    return contactList.map((c: typeof contacts.$inferSelect & { contact: typeof users.$inferSelect }) => ({
      id: c.id,
      contactId: c.contactId,
      nickname: c.nickname,
      isBlocked: c.isBlocked,
      username: c.contact.username,
      displayName: c.contact.displayName,
      avatar: c.contact.avatar,
      status: c.contact.status,
      isOnline: c.contact.isOnline,
      lastSeen: c.contact.lastSeen,
      createdAt: c.createdAt,
    }));
  }),

  add: authedQuery
    .input(
      z.object({
        contactId: z.number(),
        nickname: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (input.contactId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add yourself as a contact",
        });
      }

      // Check if contact exists
      const contactUser = await db.query.users.findFirst({
        where: eq(users.id, input.contactId),
      });

      if (!contactUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check if already a contact
      const existing = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.userId, ctx.user.id),
          eq(contacts.contactId, input.contactId)
        ),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already in your contacts",
        });
      }

      await db.insert(contacts).values({
        userId: ctx.user.id,
        contactId: input.contactId,
        nickname: input.nickname || null,
      });

      return { success: true };
    }),

  remove: authedQuery
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      await db
        .delete(contacts)
        .where(
          and(
            eq(contacts.userId, ctx.user.id),
            eq(contacts.contactId, input.contactId)
          )
        );

      return { success: true };
    }),

  toggleBlock: authedQuery
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.userId, ctx.user.id),
          eq(contacts.contactId, input.contactId)
        ),
      });

      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found",
        });
      }

      await db
        .update(contacts)
        .set({ isBlocked: !contact.isBlocked })
        .where(eq(contacts.id, contact.id));

      return { success: true, isBlocked: !contact.isBlocked };
    }),

  search: authedQuery
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      const results = await db.query.users.findMany({
        limit: 50,
      });

      // Filter locally
      const filtered = results.filter(
        (u: typeof users.$inferSelect) =>
          u.id !== ctx.user.id &&
          (u.username.toLowerCase().includes(input.query.toLowerCase()) ||
            u.displayName.toLowerCase().includes(input.query.toLowerCase()))
      );

      // Check which are already contacts
      const existingContacts = await db.query.contacts.findMany({
        where: eq(contacts.userId, ctx.user.id),
      });

      const contactIds = new Set(existingContacts.map((c: typeof contacts.$inferSelect) => c.contactId));

      return filtered.map((u: typeof users.$inferSelect) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        status: u.status,
        isOnline: u.isOnline,
        isContact: contactIds.has(u.id),
      }));
    }),
});
