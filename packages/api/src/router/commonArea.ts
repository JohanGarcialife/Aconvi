import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { commonArea, commonAreaBooking } from "@acme/db/schema";
import { createTRPCRouter, tenantProcedure, protectedProcedure } from "../trpc";
import { sendPushToUser } from "./notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  const slots: string[] = [];
  const [openH = 8, openM = 0] = openTime.split(":").map(Number);
  const [closeH = 22, closeM = 0] = closeTime.split(":").map(Number);
  let current = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (current + slotMinutes <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += slotMinutes;
  }
  return slots;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const commonAreaRouter = createTRPCRouter({

  // List all areas for a tenant
  all: tenantProcedure.query(async ({ ctx, input }) => {
    return ctx.db.query.commonArea.findMany({
      where: and(
        eq(commonArea.organizationId, input.tenantId),
        eq(commonArea.isActive, true),
      ),
    });
  }),

  // Get one area with its bookings for a given date
  availability: tenantProcedure
    .input(z.object({ areaId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const area = await ctx.db.query.commonArea.findFirst({
        where: eq(commonArea.id, input.areaId),
      });
      if (!area) throw new Error("Zona no encontrada");

      const bookings = await ctx.db.query.commonAreaBooking.findMany({
        where: and(
          eq(commonAreaBooking.commonAreaId, input.areaId),
          eq(commonAreaBooking.date, input.date),
          eq(commonAreaBooking.status, "CONFIRMADA"),
        ),
        with: { user: { columns: { name: true } } },
      });

      const allSlots = generateSlots(area.openTime, area.closeTime, area.slotDurationMinutes);

      const bookedSlots = new Set(bookings.map((b) => b.startTime));

      return {
        area,
        slots: allSlots.map((slot) => ({
          time: slot,
          available: !bookedSlots.has(slot),
          booking: bookings.find((b) => b.startTime === slot) ?? null,
        })),
      };
    }),

  // Create a booking
  book: tenantProcedure
    .input(
      z.object({
        areaId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const area = await ctx.db.query.commonArea.findFirst({
        where: eq(commonArea.id, input.areaId),
      });
      if (!area) throw new Error("Zona no encontrada");

      // Check slot is free
      const conflict = await ctx.db.query.commonAreaBooking.findFirst({
        where: and(
          eq(commonAreaBooking.commonAreaId, input.areaId),
          eq(commonAreaBooking.date, input.date),
          eq(commonAreaBooking.startTime, input.startTime),
          eq(commonAreaBooking.status, "CONFIRMADA"),
        ),
      });
      if (conflict) throw new Error("Este horario ya está reservado");

      // Compute end time
      const [h = 0, m = 0] = input.startTime.split(":").map(Number);
      const endMinutes = h * 60 + m + area.slotDurationMinutes;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      const [booking] = await ctx.db
        .insert(commonAreaBooking)
        .values({
          id: crypto.randomUUID(),
          commonAreaId: input.areaId,
          userId: ctx.session.user.id,
          date: input.date,
          startTime: input.startTime,
          endTime,
          notes: input.notes ?? null,
          status: "CONFIRMADA",
        })
        .returning();

      // Push notification for confirmation
      await sendPushToUser(ctx.db, ctx.session.user.id, {
        title: "✅ Reserva confirmada",
        body: `Has reservado ${area.name} para el ${input.date} a las ${input.startTime}`,
        data: { type: "booking_confirmed" },
      });

      return booking;
    }),

  // Cancel a booking
  cancel: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(commonAreaBooking)
        .set({ status: "CANCELADA" })
        .where(
          and(
            eq(commonAreaBooking.id, input.bookingId),
            eq(commonAreaBooking.userId, ctx.session.user.id),
          ),
        );

      await sendPushToUser(ctx.db, ctx.session.user.id, {
        title: "❌ Reserva cancelada",
        body: "Tu reserva ha sido cancelada correctamente.",
        data: { type: "booking_cancelled" },
      });

      return { ok: true };
    }),

  // My upcoming bookings
  myBookings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.commonAreaBooking.findMany({
      where: and(
        eq(commonAreaBooking.userId, ctx.session.user.id),
        eq(commonAreaBooking.status, "CONFIRMADA"),
      ),
      with: { commonArea: true },
      orderBy: (t, { asc }) => [asc(t.date), asc(t.startTime)],
    });
  }),

  // ── AF: create a new common area ─────────────────────────────────────────
  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        description: z.string().optional(),
        openTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
        slotDurationMinutes: z.number().int().min(15).max(480).default(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [area] = await ctx.db
        .insert(commonArea)
        .values({
          id: crypto.randomUUID(),
          organizationId: input.tenantId,
          name: input.name,
          description: input.description ?? null,
          openTime: input.openTime,
          closeTime: input.closeTime,
          slotDurationMinutes: input.slotDurationMinutes,
          isActive: true,
        })
        .returning();
      return area;
    }),

  // ── AF: toggle active/inactive ────────────────────────────────────────────
  toggleArea: tenantProcedure
    .input(z.object({ areaId: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(commonArea)
        .set({ isActive: input.isActive })
        .where(eq(commonArea.id, input.areaId));
      return { ok: true };
    }),

  // ── AF: view all bookings for the community ───────────────────────────────
  allBookings: tenantProcedure
    .input(
      z.object({
        areaId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Build where conditions dynamically
      const conditions = [];
      if (input.areaId) conditions.push(eq(commonAreaBooking.commonAreaId, input.areaId));
      if (input.date) conditions.push(eq(commonAreaBooking.date, input.date));

      return ctx.db.query.commonAreaBooking.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          commonArea: {
            columns: { id: true, name: true, organizationId: true },
          },
          user: { columns: { id: true, name: true, phoneNumber: true } },
        },
        orderBy: [desc(commonAreaBooking.date), desc(commonAreaBooking.startTime)],
      });
    }),
});
