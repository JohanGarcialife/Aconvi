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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
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
export const pushAuthSession = pgTable("push_auth_session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  // Temporary 6-digit OTP code sent via push
  otpCode: text("otp_code"),
  // PENDING | CONFIRMED | EXPIRED | CANCELLED
  status: text("status").notNull().default("PENDING"),
  // IP of the web login attempt
  loginIp: text("login_ip"),
  // User-Agent of the web browser
  loginUserAgent: text("login_user_agent"),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const pushAuthSessionRelations = relations(pushAuthSession, ({ one }) => ({
  user: one(user, {
    fields: [pushAuthSession.userId],
    references: [user.id],
  }),
}));
