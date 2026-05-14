import { appRouter } from "./src/root";
import { db } from "@acme/db/client";
import { eq } from "drizzle-orm";
import { notice, agendaTask } from "@acme/db/schema";

const DEMO_TENANT = "org_aconvi_demo";
const DEMO_USER = "test-user-jluis-1776971864823"; // AF Admin user

async function runTests() {
  console.log("🚀 Iniciando E2E Tests Automatizados...");
  let errors = 0;

  // Mock de sesión para tRPC
  const ctx = {
    db,
    session: {
      user: { id: DEMO_USER, email: "jluis.test@aconvi.app" }
    },
    headers: new Headers(),
  };

  const caller = appRouter.createCaller(ctx as any);

  try {
    // ---------------------------------------------------------
    // TEST 1: Tablón Digital
    // ---------------------------------------------------------
    console.log("▶️ Test 1: Tablón Digital (Notice Router)");
    
    // Crear aviso urgente fijado
    const newNotice = await caller.notice.create({
      tenantId: DEMO_TENANT,
      title: "Test Notice E2E",
      content: "Este es un aviso automático de prueba",
      type: "URGENTE",
      pinned: true,
      authorId: DEMO_USER,
    });
    console.log("  ✅ Aviso creado:", newNotice.id);

    // Listar avisos y verificar ordenación (los pinned deben venir primero)
    const notices = await caller.notice.all({ tenantId: DEMO_TENANT });
    const isPinnedFirst = notices[0].pinned === true;
    console.log("  ✅ Ordenación Pinned First:", isPinnedFirst ? "Pasa" : "Falla");
    if (!isPinnedFirst) errors++;

    // Desfijar
    await caller.notice.togglePin({ tenantId: DEMO_TENANT, id: newNotice.id, pinned: false });
    console.log("  ✅ Toggle Pin funciona");

    // Limpiar (Borrar aviso creado usando Drizzle directamente ya que no hay endpoint delete notice)
    await db.delete(notice).where(eq(notice.id, newNotice.id));

    // ---------------------------------------------------------
    // TEST 2: Agenda Inteligente
    // ---------------------------------------------------------
    console.log("\n▶️ Test 2: Agenda Inteligente (Agenda Router)");
    
    // Crear tarea
    const newTask = await caller.agenda.create({
      tenantId: DEMO_TENANT,
      title: "E2E Task",
      category: "MANTENIMIENTO",
      dueDate: "2026-12-31",
      recurrence: "NONE"
    });
    console.log("  ✅ Tarea creada:", newTask.id);

    // Listar tareas
    const tasks = await caller.agenda.all({ tenantId: DEMO_TENANT, showDone: false });
    const taskFound = tasks.find(t => t.id === newTask.id);
    console.log("  ✅ Tarea listada:", taskFound ? "Pasa" : "Falla");
    if (!taskFound) errors++;

    // Probar unified endpoint (getCalendarEvents)
    const calendar = await caller.agenda.getCalendarEvents({
      tenantId: DEMO_TENANT,
      year: 2026,
      month: 12
    });
    const calendarEvt = calendar.find(e => e.id === newTask.id);
    console.log("  ✅ Evento devuelto en el Calendario:", calendarEvt ? "Pasa" : "Falla");
    if (!calendarEvt) errors++;

    // Marcar hecha y borrar
    await caller.agenda.done({ id: newTask.id });
    await caller.agenda.delete({ id: newTask.id });
    console.log("  ✅ Completar y borrar tarea funciona");

  } catch (error) {
    console.error("❌ E2E Error durante las pruebas:", error);
    errors++;
  }

  if (errors > 0) {
    console.log(`\n❌ Tests fallaron con ${errors} errores.`);
    process.exit(1);
  } else {
    console.log("\n✅ Todos los flujos E2E API pasaron correctamente.");
    process.exit(0);
  }
}

runTests();
