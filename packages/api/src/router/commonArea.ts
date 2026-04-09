import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { commonArea, commonAreaBooking } from "@acme/db/schema";
import { createTRPCRouter, tenantProcedure, protectedProcedure } from "../trpc";

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
});
