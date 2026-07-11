import { eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { InsertUser } from "../../db/schema";
import { getDb } from "./connection";

export async function findUserByUsername(username: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        displayName: values.displayName,
        avatar: values.avatar,
        isOnline: values.isOnline,
        lastSeen: new Date(),
        updatedAt: new Date(),
      },
    });
}
