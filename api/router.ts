import { customAuthRouter } from "./custom-auth-router";
import { chatRouter } from "./chat-router";
import { contactRouter } from "./contact-router";
import { callRouter } from "./call-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: customAuthRouter,
  chat: chatRouter,
  contact: contactRouter,
  call: callRouter,
});

export type AppRouter = typeof appRouter;
