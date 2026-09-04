import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { member, organization, provider, user } from "./auth-schema";

// ─── Re-export from other schemas for convenience ───────────────────────────
export * from "./auth-schema";
export * from "./notification-schema";

// ─── Post ───────────────────────────────────────────────────────────────────
export const Post = pgTable("post", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const CreatePostSchema = createInsertSchema(Post).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const commonAreaBookingRelations = relations(
  commonAreaBooking,
  ({ one }) => ({
    commonArea: one(commonArea, {
      fields: [commonAreaBooking.commonAreaId],
      references: [commonArea.id],
    }),
    user: one(user, {
      fields: [commonAreaBooking.userId],
      references: [user.id],
    }),
  }),
);

// ─── Incident ─────────────────────────────────────────────────────────────────
export const incident = pgTable("incident", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  description: t.text().notNull(),
  category: t.varchar({ length: 64 }).notNull().default("otro"),
  photoUrl: t.text("photo_url"),
  // Foto final subida por el proveedor al cerrar el trabajo
  finalPhotoUrl: t.text("final_photo_url"),
  status: t.varchar({ length: 64 }).notNull().default("RECIBIDA"),
  priority: t.varchar({ length: 64 }).notNull().default("MEDIA"), // BAJA, MEDIA, ALTA, URGENTE
  organizationId: t
    .text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  reporterId: t
    .text("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  assigneeId: t.text("assignee_id").references(() => user.id, {
    onDelete: "set null",
  }),
  providerId: t.uuid("provider_id").references(() => provider.id, {
    onDelete: "set null",
  }),
  expiredProviderId: t.varchar("expired_provider_id", { length: 128 }),
  estimatedCost: t.real("estimated_cost"),
  estimatedDays: t.integer("estimated_days"),
  rating: t.integer("rating"),
  ratingComment: t.text("rating_comment"),
  assignedAt: t.timestamp("assigned_at", { mode: "date", withTimezone: true }),
  startedAt: t.timestamp("started_at", { mode: "date", withTimezone: true }),
  resolvedAt: t.timestamp("resolved_at", { mode: "date", withTimezone: true }),
  rejectedAt: t.timestamp("rejected_at", { mode: "date", withTimezone: true }),
  scheduledAt: t.timestamp("scheduled_at", {
    mode: "date",
    withTimezone: true,
  }),
  estimatedDuration: t.varchar("estimated_duration", { length: 32 }),
  createdAt: t
    .timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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
  history: many(incidentHistory),
}));

// ─── Incident Note ────────────────────────────────────────────────────────────
export const incidentNote = pgTable("incident_note", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  incidentId: t
    .uuid("incident_id")
    .notNull()
    .references(() => incident.id, { onDelete: "cascade" }),
  authorId: t
    .text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: t.text().notNull(),
  createdAt: t
    .timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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

// ─── Incident History (Trazabilidad) ──────────────────────────────────────────
export const incidentHistory = pgTable("incident_history", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  incidentId: t
    .uuid("incident_id")
    .notNull()
    .references(() => incident.id, { onDelete: "cascade" }),
  actorName: t.varchar("actor_name", { length: 128 }).notNull(),
  action: t.varchar({ length: 64 }).notNull(), // CREATED, STATUS_CHANGED, ASSIGNED, COMPLETED, COMMENT
  previousStatus: t.varchar("previous_status", { length: 64 }),
  newStatus: t.varchar("new_status", { length: 64 }),
  comment: t.text(),
  createdAt: t
    .timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
}));

export const incidentHistoryRelations = relations(
  incidentHistory,
  ({ one }) => ({
    incident: one(incident, {
      fields: [incidentHistory.incidentId],
      references: [incident.id],
    }),
  }),
);

// ─── Notice ───────────────────────────────────────────────────────────────────
export const notice = pgTable("notice", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  type: t.varchar({ length: 32 }).notNull().default("COMUNICADO"), // COMUNICADO | AVISO | URGENTE
  pinned: t.boolean().notNull().default(false),
  organizationId: t
    .text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: t
    .text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: t
    .timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Push Login Request ────────────────────────────────────────────────────────
// Tracks corporate push-based login flow (web → push → approval → session)
export const pushLoginRequest = pgTable("push_login_request", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: varchar({ length: 32 }).notNull().default("PENDING"), // PENDING, APPROVED, REJECTED, EXPIRED
  // IP and device info at time of request (for security validation)
  requestIp: text("request_ip"),
  requestUserAgent: text("request_user_agent"),
  // Once approved, the session token is stored here so the web can pick it up
  sessionToken: text("session_token"),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const pushLoginRequestRelations = relations(
  pushLoginRequest,
  ({ one }) => ({
    user: one(user, {
      fields: [pushLoginRequest.userId],
      references: [user.id],
    }),
  }),
);

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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const communityDocumentRelations = relations(
  communityDocument,
  ({ one }) => ({
    organization: one(organization, {
      fields: [communityDocument.organizationId],
      references: [organization.id],
    }),
    author: one(user, {
      fields: [communityDocument.authorId],
      references: [user.id],
    }),
  }),
);

// ─── Vote Session ──────────────────────────────────────────────────────────────
// Represents a single voting session or junta (e.g. "Reparación del ascensor" or "Junta extraordinaria")
export const voteSession = pgTable("vote_session", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: varchar({ length: 32 }).notNull().default("SINGLE"), // "SINGLE" (Decisión sin junta) | "JUNTA" (Junta con varios puntos)
  title: varchar({ length: 256 }).notNull(),
  budget: varchar({ length: 64 }), // e.g. "5.500 €"
  description: text(),
  status: varchar({ length: 32 }).notNull().default("OPEN"), // DRAFT, OPEN, CLOSED
  coefficientWeighted: boolean("coefficient_weighted").default(true).notNull(),
  priority: integer("priority").default(0).notNull(), // 0: Normal, 1: Alta, etc.
  closesAt: timestamp("closes_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  closedAt: timestamp("closed_at", { mode: "date", withTimezone: true }),
  archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
  // Convocatoria de Junta sincronizada
  meetingDate: timestamp("meeting_date", { mode: "date", withTimezone: true }),
  meetingLocation: text("meeting_location"),
  secondCallDate: timestamp("second_call_date", {
    mode: "date",
    withTimezone: true,
  }),
  convocationGeneratedAt: timestamp("convocation_generated_at", {
    mode: "date",
    withTimezone: true,
  }),
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
  items: many(voteItem),
  options: many(voteOption),
  casts: many(voteCast),
  budgetProposals: many(voteBudgetProposal),
  minute: one(voteMinute, {
    fields: [voteSession.id],
    references: [voteMinute.sessionId],
  }),
}));

// ─── Vote Item ─────────────────────────────────────────────────────────────────
// Each individual agenda point/decision in a Junta or Single session
export const voteItem = pgTable("vote_item", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(1),
  title: varchar({ length: 256 }).notNull(),
  budget: varchar({ length: 64 }), // e.g. "1.200 €"
  description: text(),
  onlineVotingEnabled: boolean("online_voting_enabled").default(true).notNull(), // Toggle AF: ¿Votar este punto antes de la junta?
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const voteItemRelations = relations(voteItem, ({ one, many }) => ({
  session: one(voteSession, {
    fields: [voteItem.sessionId],
    references: [voteSession.id],
  }),
  casts: many(voteCast),
  budgetProposals: many(voteBudgetProposal),
}));

// ─── Vote Budget Proposal (Presupuestos / Alternativas de empresas) ─────────────
export const voteBudgetProposal = pgTable("vote_budget_proposal", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  itemId: uuid("item_id"), // Referencia opcional a un punto concreto de una Junta
  companyName: varchar("company_name", { length: 256 }).notNull(),
  amount: varchar("amount", { length: 64 }).notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  fileName: varchar("file_name", { length: 256 }),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const voteBudgetProposalRelations = relations(
  voteBudgetProposal,
  ({ one, many }) => ({
    session: one(voteSession, {
      fields: [voteBudgetProposal.sessionId],
      references: [voteSession.id],
    }),
    item: one(voteItem, {
      fields: [voteBudgetProposal.itemId],
      references: [voteItem.id],
    }),
    casts: many(voteCast),
  }),
);

// ─── Vote Option (Legacy fallback) ─────────────────────────────────────────────
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
// Records each individual vote cast by a resident (for a session or specific item)
export const voteCast = pgTable("vote_cast", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => voteSession.id, { onDelete: "cascade" }),
  itemId: uuid("item_id"), // Optional reference to specific vote_item in Junta
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  choice: varchar({ length: 32 }).notNull().default("APPROVE"), // "APPROVE" (Apruebo), "REJECT" (Rechazo), "ABSTAIN" (Me abstengo)
  optionId: uuid("option_id"), // Optional legacy reference
  selectedProposalId: uuid("selected_proposal_id"), // Presupuesto preferido (si aplica)
  coefficient: real("coefficient").notNull().default(1), // resident coefficient percentage (e.g. 4.5)
  castAt: timestamp("cast_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  ipAddress: varchar("ip_address", { length: 64 }), // for audit/timestamping
});

export const voteCastRelations = relations(voteCast, ({ one }) => ({
  session: one(voteSession, {
    fields: [voteCast.sessionId],
    references: [voteSession.id],
  }),
  item: one(voteItem, {
    fields: [voteCast.itemId],
    references: [voteItem.id],
  }),
  user: one(user, {
    fields: [voteCast.userId],
    references: [user.id],
  }),
  option: one(voteOption, {
    fields: [voteCast.optionId],
    references: [voteOption.id],
  }),
  selectedProposal: one(voteBudgetProposal, {
    fields: [voteCast.selectedProposalId],
    references: [voteBudgetProposal.id],
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
  generatedAt: timestamp("generated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
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

// ─── Fee (Cuota) ─────────────────────────────────────────────────────────────
export const fee = pgTable("fee", {
  id: uuid().notNull().primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  description: varchar("description", { length: 256 }).notNull(),
  status: varchar("status", { length: 64 }).notNull().default("PENDING"), // PENDING, PAID, OVERDUE
  dueDate: varchar("due_date", { length: 10 }), // ISO date YYYY-MM-DD
  paidAt: timestamp("paid_at", { mode: "date", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const feeRelations = relations(fee, ({ one }) => ({
  organization: one(organization, {
    fields: [fee.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [fee.userId],
    references: [user.id],
  }),
}));
