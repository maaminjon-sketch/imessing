import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
} from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  avatar: text("avatar"),
  status: varchar("status", { length: 255 }).default("Hey there! I'm using iMessing"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== CHATS ====================
export const chats = mysqlTable("chats", {
  id: serial("id").primaryKey(),
  type: mysqlEnum("type", ["private", "group"]).default("private").notNull(),
  name: varchar("name", { length: 100 }),
  avatar: text("avatar"),
  createdBy: bigint("created_by", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Chat = typeof chats.$inferSelect;

// ==================== CHAT MEMBERS ====================
export const chatMembers = mysqlTable("chat_members", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  isAdmin: boolean("is_admin").default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export type ChatMember = typeof chatMembers.$inferSelect;

// ==================== MESSAGES ====================
export const messages = mysqlTable("messages", {
  id: serial("id").primaryKey(),
  chatId: bigint("chat_id", { mode: "number", unsigned: true }).notNull(),
  senderId: bigint("sender_id", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", ["text", "image", "file", "voice", "call"]).default("text").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 255 }),
  fileSize: bigint("file_size", { mode: "number", unsigned: true }),
  duration: bigint("duration", { mode: "number", unsigned: true }), // for voice messages in seconds
  isEdited: boolean("is_edited").default(false),
  isDeleted: boolean("is_deleted").default(false),
  replyTo: bigint("reply_to", { mode: "number", unsigned: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Message = typeof messages.$inferSelect;

// ==================== MESSAGE READ STATUS ====================
export const messageReads = mysqlTable("message_reads", {
  id: serial("id").primaryKey(),
  messageId: bigint("message_id", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  readAt: timestamp("read_at").defaultNow().notNull(),
});

// ==================== CONTACTS ====================
export const contacts = mysqlTable("contacts", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  contactId: bigint("contact_id", { mode: "number", unsigned: true }).notNull(),
  nickname: varchar("nickname", { length: 100 }),
  isBlocked: boolean("is_blocked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;

// ==================== CALLS ====================
export const calls = mysqlTable("calls", {
  id: serial("id").primaryKey(),
  callerId: bigint("caller_id", { mode: "number", unsigned: true }).notNull(),
  calleeId: bigint("callee_id", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["missed", "answered", "rejected", "ended"]).default("missed").notNull(),
  duration: bigint("duration", { mode: "number", unsigned: true }).default(0), // in seconds
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export type Call = typeof calls.$inferSelect;

// ==================== USER SESSIONS ====================
export const userSessions = mysqlTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserSession = typeof userSessions.$inferSelect;

export const googleDriveCredentials = mysqlTable("google_drive_credentials", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  googleUserId: varchar("google_user_id", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  refreshToken: text("refresh_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type GoogleDriveCredential = typeof googleDriveCredentials.$inferSelect;
