import { sql, relations } from "drizzle-orm";
import { pgTable, integer, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organization, user } from "./auth-schema";

// ─── Post (demo) ──────────────────────────────────────────────────────────────
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

// ─── Provider ─────────────────────────────────────────────────────────────────
// External companies or technicians that can be assigned to resolve incidents.
export const provider = pgTable("provider", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 256 }).notNull(),
  avatarInitials: t.varchar("avatar_initials", { length: 4 }).default("?").notNull(),
  rating: real("rating").default(0).notNull(),           // 0–5
  isTrusted: boolean("is_trusted").default(false).notNull(),
  speciality: t.varchar({ length: 128 }),                // e.g. "Fontanería"
  completedJobs: integer("completed_jobs").default(0).notNull(),
  avgDaysToResolve: integer("avg_days").default(0).notNull(),
  priceRangeMin: integer("price_min"),                   // EUR
  priceRangeMax: integer("price_max"),
  phone: t.varchar({ length: 32 }),
  email: t.varchar({ length: 256 }),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const providerRelations = relations(provider, ({ one, many }) => ({
  organization: one(organization, {
    fields: [provider.organizationId],
    references: [organization.id],
  }),
  incidents: many(incident),
}));

// ─── Incident ─────────────────────────────────────────────────────────────────
// 5-step workflow: RECIBIDA → EN_REVISION → AGENDADA → EN_CURSO → RESUELTA
// Terminal alternative: RECHAZADA
export const incident = pgTable("incident", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  description: t.text().notNull(),
  photoUrl: t.varchar({ length: 1024 }),
  status: t.varchar({ length: 64 }).notNull().default("RECIBIDA"),
  priority: t.varchar({ length: 64 }).notNull().default("MEDIA"), // BAJA, MEDIA, ALTA, URGENTE
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  reporterId: t.text("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  assigneeId: t.text("assignee_id").references(() => user.id, {
    onDelete: "set null",
  }),
  providerId: t.uuid("provider_id").references(() => provider.id, {
    onDelete: "set null",
  }),
  resolvedAt: t.timestamp("resolved_at"),
  rejectedAt: t.timestamp("rejected_at"),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const incidentRelations = relations(incident, ({ one, many }) => ({
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
  provider: one(provider, {
    fields: [incident.providerId],
    references: [provider.id],
  }),
  notes: many(incidentNote),
}));

// ─── Incident Note ────────────────────────────────────────────────────────────
// Internal notes added by AF agents during incident management.
export const incidentNote = pgTable("incident_note", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  incidentId: t.uuid("incident_id")
    .notNull()
    .references(() => incident.id, { onDelete: "cascade" }),
  authorId: t.text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
}));

export const incidentNoteRelations = relations(incidentNote, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentNote.incidentId],
    references: [incident.id],
  }),
  author: one(user, {
    fields: [incidentNote.authorId],
    references: [user.id],
  }),
}));

// ─── Notice ───────────────────────────────────────────────────────────────────
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

// ─── Common Areas ─────────────────────────────────────────────────────────────
export const commonArea = pgTable("common_area", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  organizationId: t.text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 128 }).notNull(),
  description: t.text(),
  capacity: t.integer().default(10).notNull(),
  icon: t.varchar({ length: 32 }).default("🏠").notNull(),
  rules: t.text(),
  openTime: t.varchar({ length: 5 }).default("08:00").notNull(),
  closeTime: t.varchar({ length: 5 }).default("22:00").notNull(),
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
  date: t.varchar({ length: 10 }).notNull(),
  startTime: t.varchar({ length: 5 }).notNull(),
  endTime: t.varchar({ length: 5 }).notNull(),
  status: t.varchar({ length: 32 }).default("CONFIRMADA").notNull(),
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
