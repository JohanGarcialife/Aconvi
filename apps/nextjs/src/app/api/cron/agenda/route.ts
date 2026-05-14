import { NextResponse } from "next/server";
import { db } from "@acme/db/client";
import { agendaTask } from "@acme/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { sendPushToUser } from "@acme/api";

export async function GET(request: Request) {
  // 1. Verify cron secret to prevent unauthorized execution
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Determine tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    // 3. Find pending tasks due tomorrow
    const expiringTasks = await db.query.agendaTask.findMany({
      where: and(
        eq(agendaTask.isDone, false),
        eq(agendaTask.dueDate, tomorrowStr)
      ),
    });

    let sentCount = 0;

    // 4. Send reminders to the task author
    for (const task of expiringTasks) {
      if (task.authorId) {
        await sendPushToUser(db, task.authorId, {
          title: "📅 Tarea por vencer mañana",
          body: `La tarea "${task.title}" vence mañana. ¡No olvides completarla!`,
          data: { type: "agenda", taskId: task.id },
        });
        sentCount++;
      }
    }

    return NextResponse.json({ 
      ok: true, 
      tasksProcessed: expiringTasks.length,
      notificationsSent: sentCount
    });
  } catch (error) {
    console.error("[CRON AGENDA] Error processing reminders:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
