import { z } from "zod";
import { eq, and, inArray, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { chats, chatMembers, messages, messageReads } from "../db/schema";

export const chatRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    // Get all chats where user is a member
    const members = await db.query.chatMembers.findMany({
      where: eq(chatMembers.userId, userId),
    });

    const chatIds = members.map((m: typeof chatMembers.$inferSelect) => m.chatId);
    if (chatIds.length === 0) return [];

    const chatList = await db.query.chats.findMany({
      where: inArray(chats.id, chatIds),
      orderBy: [desc(chats.updatedAt)],
    });

    // Get last message for each chat
    const result = await Promise.all(
      chatList.map(async (chat: typeof chats.$inferSelect) => {
        const chatMembersList = await db.query.chatMembers.findMany({
          where: eq(chatMembers.chatId, chat.id),
          with: { user: true },
        });

        const otherMembers = chatMembersList.filter(
          (m: typeof chatMembers.$inferSelect & { user: typeof import("../db/schema").users.$inferSelect }) => m.userId !== userId
        );
        const isPrivate = chat.type === "private";

        let name = chat.name;
        let avatar = chat.avatar;

        if (isPrivate && otherMembers.length > 0) {
          name = otherMembers[0].user.displayName || otherMembers[0].user.username;
          avatar = otherMembers[0].user.avatar;
        }

        // Get last message
        const lastMessage = await db.query.messages.findFirst({
          where: and(eq(messages.chatId, chat.id), eq(messages.isDeleted, false)),
          orderBy: [desc(messages.createdAt)],
          with: { sender: true },
        });

        // Get unread count
        const allMessages = await db.query.messages.findMany({
          where: and(
            eq(messages.chatId, chat.id),
            eq(messages.isDeleted, false),
          ),
        });

        const readMessages = await db.query.messageReads.findMany({
          where: eq(messageReads.userId, userId),
        });

        const readMessageIds = new Set(readMessages.map((r: typeof messageReads.$inferSelect) => r.messageId));
        const unread = allMessages.filter(
          (m: typeof messages.$inferSelect) => m.senderId !== userId && !readMessageIds.has(m.id)
        ).length;

        return {
          id: chat.id,
          type: chat.type,
          name,
          avatar,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                type: lastMessage.type,
                senderName: lastMessage.sender?.displayName || "Unknown",
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount: unread,
          members: chatMembersList.map((m: typeof chatMembers.$inferSelect & { user: typeof import("../db/schema").users.$inferSelect }) => ({
            id: m.userId,
            displayName: m.user.displayName,
            username: m.user.username,
            avatar: m.user.avatar,
            isOnline: m.user.isOnline,
          })),
          updatedAt: chat.updatedAt,
        };
      })
    );

    return result;
  }),

  getOrCreatePrivate: authedQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const currentUserId = ctx.user.id;
      const otherUserId = input.userId;

      // Find existing private chat between these two users
      const allChats = await db.query.chats.findMany({
        where: eq(chats.type, "private"),
      });

      for (const chat of allChats) {
        const members = await db.query.chatMembers.findMany({
          where: eq(chatMembers.chatId, chat.id),
        });

        const memberIds = members.map((m: typeof chatMembers.$inferSelect) => m.userId);
        if (
          memberIds.includes(currentUserId) &&
          memberIds.includes(otherUserId)
        ) {
          return { chatId: chat.id };
        }
      }

      // Create new chat
      const newChat = await db.insert(chats).values({
        type: "private",
        createdBy: currentUserId,
      });

      const chatId = Number(newChat[0].insertId);

      // Add both users as members
      await db.insert(chatMembers).values([
        { chatId, userId: currentUserId },
        { chatId, userId: otherUserId },
      ]);

      return { chatId };
    }),

  createGroup: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(100),
        memberIds: z.array(z.number()).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const creatorId = ctx.user.id;

      const newChat = await db.insert(chats).values({
        type: "group",
        name: input.name,
        createdBy: creatorId,
      });

      const chatId = Number(newChat[0].insertId);

      // Add creator as admin
      await db.insert(chatMembers).values({
        chatId,
        userId: creatorId,
        isAdmin: true,
      });

      // Add other members
      for (const memberId of input.memberIds) {
        if (memberId !== creatorId) {
          await db.insert(chatMembers).values({
            chatId,
            userId: memberId,
          });
        }
      }

      return { chatId };
    }),

  getMessages: authedQuery
    .input(z.object({ chatId: z.number(), limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();

      // Verify user is a member of this chat
      const membership = await db.query.chatMembers.findFirst({
        where: and(
          eq(chatMembers.chatId, input.chatId),
          eq(chatMembers.userId, ctx.user.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this chat",
        });
      }

      const msgs = await db.query.messages.findMany({
        where: and(
          eq(messages.chatId, input.chatId),
          eq(messages.isDeleted, false)
        ),
        orderBy: [desc(messages.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: { sender: true },
      });

      // Mark messages as read
      const unreadMessages = msgs.filter((m: typeof messages.$inferSelect) => m.senderId !== ctx.user.id);
      for (const msg of unreadMessages) {
        const existingRead = await db.query.messageReads.findFirst({
          where: and(
            eq(messageReads.messageId, msg.id),
            eq(messageReads.userId, ctx.user.id)
          ),
        });

        if (!existingRead) {
          await db.insert(messageReads).values({
            messageId: msg.id,
            userId: ctx.user.id,
          });
        }
      }

      return [...msgs].reverse().map((m: typeof messages.$inferSelect & { sender: typeof import("../db/schema").users.$inferSelect | null }) => ({
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        senderName: m.sender?.displayName || "Unknown",
        senderAvatar: m.sender?.avatar,
        type: m.type,
        content: m.content,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        fileSize: m.fileSize,
        duration: m.duration,
        isEdited: m.isEdited,
        replyTo: m.replyTo,
        createdAt: m.createdAt,
      }));
    }),

  sendMessage: authedQuery
    .input(
      z.object({
        chatId: z.number(),
        type: z.enum(["text", "image", "file", "voice", "call"]).default("text"),
        content: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileSize: z.number().optional(),
        duration: z.number().optional(),
        replyTo: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify membership
      const membership = await db.query.chatMembers.findFirst({
        where: and(
          eq(chatMembers.chatId, input.chatId),
          eq(chatMembers.userId, ctx.user.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this chat",
        });
      }

      const result = await db.insert(messages).values({
        chatId: input.chatId,
        senderId: ctx.user.id,
        type: input.type,
        content: input.content || null,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
        fileSize: input.fileSize || null,
        duration: input.duration || null,
        replyTo: input.replyTo || null,
      });

      // Update chat updatedAt
      await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, input.chatId));

      return { messageId: Number(result[0].insertId) };
    }),

  deleteMessage: authedQuery
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const message = await db.query.messages.findFirst({
        where: eq(messages.id, input.messageId),
      });

      if (!message || message.senderId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages",
        });
      }

      await db
        .update(messages)
        .set({ isDeleted: true })
        .where(eq(messages.id, input.messageId));

      return { success: true };
    }),
});
