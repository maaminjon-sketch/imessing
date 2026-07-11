import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { getUserFromToken } from "./lib/auth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  token?: string;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };

  // Try custom auth token from header or cookie
  const authHeader = opts.req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token) {
    try {
      const user = await getUserFromToken(token);
      if (user) {
        ctx.user = user;
        ctx.token = token;
      }
    } catch {
      // Authentication is optional
    }
  }

  return ctx;
}
