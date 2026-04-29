import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  varchar,
  uuid,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { user, organization, provider, member } from "./auth-schema";

// ─── Re-export from other schemas for convenience ───────────────────────────
export * from "./auth-schema";
export * from "./notification-schema";

// ─── Post ───────────────────────────────────────────────────────────────────
export const Post = pgTable("post", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const CreatePostSchema = createInsertSchema(Post).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// ─── Common Area ─────────────────────────────────────────────────────────────
export const commonArea = pgTable("common_area", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: varchar({ length: 256 }).notNull(),
  description: text(),
  isActive: boolean("is_active").default(true).notNull(),
  openTime: varchar("open_time", { length: 5 }).default("08:00").notNull(),
  closeTime: varchar("close_time", { length: 5 }).default("22:00").notNull(),
  slotDurationMinutes: integer("slot_duration_minutes").default(60).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const commonAreaRelations = relations(commonArea, ({ one, many }) => ({
  organization: one(organization, {
    fields: [commonArea.organizationId],
    references: [organization.id],
  }),
  bookings: many(commonAreaBooking),
}));

// ─── Common Area Booking ─────────────────────────────────────────────────────
export const commonAreaBooking = pgTable("common_area_booking", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  commonAreaId: uuid("common_area_id")
    .notNull()
    .references(() => commonArea.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  date: varchar({ length: 10 }).notNull(), // ISO Date string: YYYY-MM-DD
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:mm
  endTime: varchar("end_time", { length: 5 }).notNull(), // HH:mm
  status: varchar({ length: 64 }).notNull().default("CONFIRMADA"), // PENDING, CONFIRMADA, CANCELADA
  notes: text(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

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

// ─── Incident ─────────────────────────────────────────────────────────────────
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
  estimatedCost: t.real("estimated_cost"),
  estimatedDays: t.integer("estimated_days"),
  assignedAt: t.timestamp("assigned_at", { mode: "date", withTimezone: true }),
  resolvedAt: t.timestamp("resolved_at", { mode: "date", withTimezone: true }),
  rejectedAt: t.timestamp("rejected_at", { mode: "date", withTimezone: true }),
  createdAt: t.timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
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
export const incidentNote = pgTable("incident_note", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  incidentId: t.uuid("incident_id")
    .notNull()
    .references(() => incident.id, { onDelete: "cascade" }),
  authorId: t.text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: t.text().notNull(),
  createdAt: t.timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
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
  createdAt: t.timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
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

// ─── Excel Template (Metadata / Helpers) ──────────────────────────────────────
export const excelImportJob = pgTable("excel_import_job", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  status: varchar({ length: 64 }).notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED
  resultJson: text(), // Summary of imports
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

// ─── Community Document ────────────────────────────────────────────────────────
// Stores metadata and URLs for community documents (actas, estatutos, etc.)
// Files are hosted externally (Google Drive, Dropbox, etc.) — URL-based approach.
export const communityDocument = pgTable("community_document", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: varchar({ length: 256 }).notNull(),
  description: text(),
  category: varchar({ length: 64 }).notNull().default("OTRO"), // ACTA, ESTATUTO, REGLAMENTO, CONTRATO, OTRO
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 256 }).notNull(),
  mimeType: varchar("mime_type", { length: 128 }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const communityDocumentRelations = relations(communityDocument, ({ one }) => ({
  organization: one(organization, {
    fields: [communityDocument.organizationId],
    references: [organization.id],
  }),
  author: one(user, {
    fields: [communityDocument.authorId],
    references: [user.id],
  }),
}));

// ─── Vote Session ──────────────────────────────────────────────────────────────
// Represents a single voting session (e.g. "Aprobación obras piscina")
export const voteSession = pgTable("vote_session", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: varchar({ length: 256 }).notNull(),
  description: text(),
  status: varchar({ length: 32 }).notNull().default("DRAFT"), // DRAFT, OPEN, CLOSED
  coefficientWeighted: boolean("coefficient_weighted").default(false).notNull(),
  closesAt: timestamp("closes_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
});

export const voteSessionRelations = relations(voteSession, ({ one, many }) => ({
  organization: one(organization, {
    fields: [voteSession.organizationId],
    references: [organization.id],
  }),
  author: one(user, {
    fields: [voteSession.authorId],
    references: [user.id],
  }),
  options: many(voteOption),
  casts: many(voteCast),
  minute: one(voteMinute, {
    fields: [voteSession.id],
    references: [voteMinute.sessionId],
  }),
}));

// ─── Vote Option ───────────────────────────────────────────────────────────────
// Each possible answer within a voting session
export const voteOption = pgTable("vote_option", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  label: varchar({ length: 256 }).notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  weightedTotal: real("weighted_total").notNull().default(0),
  displayOrder: integer("display_order").notNull().default(0),
});

export const voteOptionRelations = relations(voteOption, ({ one, many }) => ({
  session: one(voteSession, {
    fields: [voteOption.sessionId],
    references: [voteSession.id],
  }),
  casts: many(voteCast),
}));

// ─── Vote Cast ─────────────────────────────────────────────────────────────────
// Records each individual vote cast by a resident
export const voteCast = pgTable("vote_cast", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  optionId: uuid("option_id")
    .notNull()
    .references(() => voteOption.id, { onDelete: "cascade" }),
  coefficient: real("coefficient").notNull().default(1), // resident coefficient at time of vote
  castAt: timestamp("cast_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 64 }), // for audit/timestamping
});

export const voteCastRelations = relations(voteCast, ({ one }) => ({
  session: one(voteSession, {
    fields: [voteCast.sessionId],
    references: [voteSession.id],
  }),
  user: one(user, {
    fields: [voteCast.userId],
    references: [user.id],
  }),
  option: one(voteOption, {
    fields: [voteCast.optionId],
    references: [voteOption.id],
  }),
}));

// ─── Vote Minute ───────────────────────────────────────────────────────────────
// Auto-generated minutes document when a session is closed
export const voteMinute = pgTable("vote_minute", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  content: text().notNull(), // plain text minutes content
  generatedAt: timestamp("generated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const voteMinuteRelations = relations(voteMinute, ({ one }) => ({
  session: one(voteSession, {
    fields: [voteMinute.sessionId],
    references: [voteSession.id],
  }),
}));

// ─── Agenda Task ───────────────────────────────────────────────────────────────
// Tasks for the Property Manager's intelligent agenda
export const agendaTask = pgTable("agenda_task", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: varchar({ length: 256 }).notNull(),
  description: text(),
  category: varchar({ length: 64 }).notNull().default("ADMINISTRATIVO"), // MANTENIMIENTO, LEGAL, ADMINISTRATIVO, FINANCIERO, OTRO
  dueDate: varchar("due_date", { length: 10 }).notNull(), // ISO date YYYY-MM-DD
  recurrence: varchar({ length: 32 }).notNull().default("NONE"), // NONE, WEEKLY, MONTHLY, ANNUAL
  isDone: boolean("is_done").notNull().default(false),
  doneAt: timestamp("done_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const agendaTaskRelations = relations(agendaTask, ({ one }) => ({
  organization: one(organization, {
    fields: [agendaTask.organizationId],
    references: [organization.id],
  }),
  author: one(user, {
    fields: [agendaTask.authorId],
    references: [user.id],
  }),
}));

