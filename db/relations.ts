import { relations } from "drizzle-orm";
import { users, chats, chatMembers, messages, contacts, calls } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  chatMembers: many(chatMembers),
  sentMessages: many(messages, { relationName: "sender" }),
  contacts: many(contacts, { relationName: "userContacts" }),
  callsMade: many(calls, { relationName: "caller" }),
  callsReceived: many(calls, { relationName: "callee" }),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
  messages: many(messages),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [chatMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: "userContacts",
  }),
  contact: one(users, {
    fields: [contacts.contactId],
    references: [users.id],
    relationName: "contactUser",
  }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  caller: one(users, {
    fields: [calls.callerId],
    references: [users.id],
    relationName: "caller",
  }),
  callee: one(users, {
    fields: [calls.calleeId],
    references: [users.id],
    relationName: "callee",
  }),
}));
