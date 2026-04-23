import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const platformEnum = pgEnum("push_platform", ["web", "expo"]);

export const pushToken = pgTable("push_token", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  platform: platformEnum("platform").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const pushTokenRelations = relations(pushToken, ({ one }) => ({
  user: one(user, {
    fields: [pushToken.userId],
    references: [user.id],
  }),
}));

// ─── Push Auth Session ────────────────────────────────────────────────────────
// Records pending push-based login attempts:
//   1. User enters corporate username on web
//   2. A pushAuthSession is created (status=PENDING, expires in 3 min)
//   3. Push notification sent to the user's linked device
//   4. The mobile app receives and sends confirmPushAccess → status=CONFIRMED
//   5. Web polls pollPushStatus → detects CONFIRMED → creates Better-Auth session
export const pushAuthSession = pgTable("push_auth_session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  // PENDING | CONFIRMED | EXPIRED | CANCELLED
  status: text("status").notNull().default("PENDING"),
  // IP of the web login attempt (for session validation)
  loginIp: text("login_ip"),
  // User-Agent of the web browser
  loginUserAgent: text("login_user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushAuthSessionRelations = relations(pushAuthSession, ({ one }) => ({
  user: one(user, {
    fields: [pushAuthSession.userId],
    references: [user.id],
  }),
}));
