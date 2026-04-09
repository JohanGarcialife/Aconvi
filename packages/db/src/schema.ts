import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

import { organization, user } from "./auth-schema";
import { relations } from "drizzle-orm";

export const incident = pgTable("incident", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  description: t.text().notNull(),
  photoUrl: t.varchar({ length: 1024 }),
  status: t.varchar({ length: 64 }).notNull().default("PENDIENTE"), // PENDIENTE, EN_CURSO, RESUELTO, RECHAZADO
  priority: t.varchar({ length: 64 }).notNull().default("MEDIA"), // BAJA, MEDIA, ALTA
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  reporterId: t.text("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  assigneeId: t.text("assignee_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const incidentRelations = relations(incident, ({ one }) => ({
  organization: one(organization, {
    fields: [incident.organizationId],
    references: [organization.id],
  }),
  reporter: one(user, {
    fields: [incident.reporterId],
    references: [user.id],
    relationName: "reporter",
  }),
  assignee: one(user, {
    fields: [incident.assigneeId],
    references: [user.id],
    relationName: "assignee",
  }),
}));

export const notice = pgTable("notice", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: t.text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const noticeRelations = relations(notice, ({ one }) => ({
  organization: one(organization, {
    fields: [notice.organizationId],
    references: [organization.id],
  }),
  author: one(user, {
    fields: [notice.authorId],
    references: [user.id],
  }),
}));

export * from "./auth-schema";
export * from "./notification-schema";

// ─── Common Areas ────────────────────────────────────────────────────────────
export const commonArea = pgTable("common_area", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 128 }).notNull(),           // ej: "Piscina", "Sala de reuniones"
  description: t.text(),
  capacity: t.integer().default(10).notNull(),
  icon: t.varchar({ length: 32 }).default("🏠").notNull(), // emoji icon
  rules: t.text(),                                         // reglas en texto libre
  openTime: t.varchar({ length: 5 }).default("08:00").notNull(),  // "HH:MM"
  closeTime: t.varchar({ length: 5 }).default("22:00").notNull(), // "HH:MM"
  slotDurationMinutes: t.integer().default(60).notNull(),
  isActive: t.boolean().default(true).notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const commonAreaBooking = pgTable("common_area_booking", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  commonAreaId: t.uuid("common_area_id")
    .notNull()
    .references(() => commonArea.id, { onDelete: "cascade" }),
  userId: t.text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: t.varchar({ length: 10 }).notNull(),    // "YYYY-MM-DD"
  startTime: t.varchar({ length: 5 }).notNull(), // "HH:MM"
  endTime: t.varchar({ length: 5 }).notNull(),   // "HH:MM"
  status: t.varchar({ length: 32 }).default("CONFIRMADA").notNull(), // CONFIRMADA, CANCELADA
  notes: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const commonAreaRelations = relations(commonArea, ({ one, many }) => ({
  organization: one(organization, {
    fields: [commonArea.organizationId],
    references: [organization.id],
  }),
  bookings: many(commonAreaBooking),
}));

export const commonAreaBookingRelations = relations(commonAreaBooking, ({ one }) => ({
  commonArea: one(commonArea, {
    fields: [commonAreaBooking.commonAreaId],
    references: [commonArea.id],
  }),
  user: one(user, {
    fields: [commonAreaBooking.userId],
    references: [user.id],
  }),
}));
