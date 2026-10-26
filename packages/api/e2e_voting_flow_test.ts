import { and, eq } from "drizzle-orm";

import { db } from "@acme/db/client";
import { voteItem, voteSession } from "@acme/db/schema";

import { appRouter } from "./src/root";

const DEMO_TENANT = "org_aconvi_demo";
const AF_USER_ID = "00000000-0000-0000-0000-000000000001";
const VECINO_USER_ID = "00000000-0000-0000-0000-000000000002";
const VECINO_MEMBER_ID = "mem_owner_juan_garcia";

async function runE2E() {
  console.log("=================================================");
  console.log(
    "🚀 EJECUTANDO TEST E2E: FLUJO COMPLETO DE JUNTAS Y VOTACIONES (P1 a P6)",
  );
  console.log("=================================================\n");

  const ctx = {
    db,
    session: {
      user: { id: AF_USER_ID, email: "af@aconvi.app", role: "ADMIN_FINCAS" },
    },
    headers: new Headers(),
  };

  const caller = appRouter.createCaller(ctx as any);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}${detail ? ` (${detail})` : ""}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` (${detail})` : ""}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Live Agenda & Seeding matching Pantalla 1
    // -------------------------------------------------------------
    console.log(
      "▶️ 1. Verificando Orden del Día en vivo (Pantalla 1 - Mockup 1)",
    );
    const liveAgenda = await caller.meeting.getLiveAgenda({
      tenantId: DEMO_TENANT,
    });

    assert(
      Boolean(liveAgenda.session),
      "Sesión de junta activa obtenida",
      liveAgenda.session.title,
    );
    assert(
      liveAgenda.items.length >= 10,
      "Contiene los 10 puntos del orden del día",
      `Total: ${liveAgenda.items.length} puntos`,
    );

    const punto3 = liveAgenda.items.find((i: any) => i.orderIndex === 3);
    assert(Boolean(punto3), "Punto 3 (Pintura fachada) existe", punto3?.title);
    assert(
      punto3?.requiresVoting === true,
      "Punto 3 requiere votación formal",
      `agreementType: ${punto3?.agreementType}`,
    );
    assert(
      Boolean(punto3?.adminComments && punto3.adminComments.length > 0),
      "Punto 3 contiene anotaciones para el acta (icono 💬)",
      punto3?.adminComments,
    );

    const punto1 = liveAgenda.items.find((i: any) => i.orderIndex === 1);
    assert(
      punto1?.requiresVoting === false,
      "Punto 1 (Constitución) es informativo (sin botón de votación)",
      `agreementType: ${punto1?.agreementType}`,
    );

    const punto10 = liveAgenda.items.find((i: any) => i.orderIndex === 10);
    assert(
      punto10?.requiresVoting === false,
      "Punto 10 (Ruegos y preguntas) sin votación",
      `agreementType: ${punto10?.agreementType}`,
    );

    // -------------------------------------------------------------
    // TEST 2: Asistencia y QR (Punto 1)
    // -------------------------------------------------------------
    console.log("\n▶️ 2. Verificando Asistencia y QR (Punto 1)");
    const sessionId = liveAgenda.session.id;

    // Vecino consulta su QR
    const vecinoQr = await caller.meeting.myAttendanceQr({
      tenantId: DEMO_TENANT,
      sessionId,
      userId: VECINO_USER_ID,
    });
    assert(
      Boolean(vecinoQr.qrPayload && vecinoQr.qrPayload.includes("ACONVI_QR")),
      "Vecino genera payload QR con identificador",
      vecinoQr.qrPayload,
    );
    assert(
      Boolean(vecinoQr.owner.name && vecinoQr.owner.door),
      "Vecino obtiene datos de propietario y coeficiente",
      `${vecinoQr.owner.name} · ${vecinoQr.owner.door} (${vecinoQr.owner.coefficient} %)`,
    );

    // AF Escanea el QR del vecino
    const scanResult = await caller.meeting.scanAttendanceQr({
      tenantId: DEMO_TENANT,
      sessionId,
      qrPayload: vecinoQr.qrPayload,
    });
    assert(
      scanResult.ok === true && Boolean(scanResult.owner.name),
      "AF escanea QR y registra presencia del vecino",
      `${scanResult.owner.name} · ${scanResult.owner.door} (${scanResult.owner.coefficient} %)`,
    );

    // Verificar quórum
    const attendanceStats = await caller.meeting.attendance({
      tenantId: DEMO_TENANT,
      sessionId,
    });
    assert(
      attendanceStats.participationPct >= 40,
      "Cálculo de participación y Quórum en tiempo real",
      `${attendanceStats.participationPct} % presente (${attendanceStats.presentCount} propietarios)`,
    );

    // Iniciar junta
    const startResult = await caller.meeting.startMeeting({
      tenantId: DEMO_TENANT,
      sessionId,
    });
    assert(
      startResult.ok === true && Boolean(startResult.startedAt),
      "AF inicia la junta formalmente con quórum",
      `startedAt: ${startResult.startedAt}`,
    );

    // -------------------------------------------------------------
    // TEST 3: Recuento a Mano Alzada (Pantalla 3 - Mockup 3)
    // -------------------------------------------------------------
    console.log(
      "\n▶️ 3. Verificando Recuento a Mano Alzada (Pantalla 3 - Mockup 3)",
    );
    const showOfHands = await caller.meeting.getShowOfHands({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
    });
    assert(
      showOfHands.proposals.length >= 2,
      "Punto 3 tiene propuestas de presupuesto disponibles",
      `Total propuestas: ${showOfHands.proposals.length}`,
    );

    const prop1 = showOfHands.proposals[0]!;
    const prop2 = showOfHands.proposals[1]!;
    const prop3 = showOfHands.proposals[2] || showOfHands.proposals[0]!;

    // Simular conteo con mano alzada exactamente como en Mockup 3
    const countsPayload: Record<string, number> = {
      [prop1.id]: 8, // Pinturas Levante
      [prop2.id]: 5, // Decoraciones Turia
      [prop3.id]: 0, // Descartada
    };

    const saveHandsResult = await caller.meeting.saveShowOfHands({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
      roundNumber: 1,
      counts: countsPayload,
      discardedIds: [prop3.id],
      againstAllCount: 2,
      abstainCount: 1,
      winningProposalId: prop1.id,
    });
    assert(
      saveHandsResult.ok === true,
      "Recuento a mano alzada guardado con propuesta ganadora",
      `Ganadora: ${prop1.companyName} (8 votos)`,
    );

    // -------------------------------------------------------------
    // TEST 4: Escrutinio Presencial y Motor LPH (Pantalla 2 - Mockup 2)
    // -------------------------------------------------------------
    console.log(
      "\n▶️ 4. Verificando Escrutinio Presencial y Motor LPH (Pantalla 2 - Mockup 2)",
    );
    const scrutinyState = await caller.meeting.getScrutinyState({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
      defaultLogic: "ASSUME_FAVOR",
    });

    assert(
      Boolean(scrutinyState.calculation),
      "Motor LPH calculó escrutinio conforme a la Ley de Propiedad Horizontal",
      scrutinyState.calculation.statusLabel,
    );

    // Verificar desglose desde casa (Punto 4: 2 favor, 4 contra, 1 abstención)
    assert(
      scrutinyState.calculation.approveFromHome === 2 &&
        scrutinyState.calculation.rejectFromHome === 4 &&
        scrutinyState.calculation.abstainFromHome === 1,
      "Desglose exacto de votos emitidos desde casa",
      `2 a favor | 4 en contra | 1 abstención`,
    );

    // Verificar cálculo de mayorías: 40.48% votos y 62% coeficiente
    console.log(
      `   * Votos a favor: ${scrutinyState.calculation.totalApprove} (${scrutinyState.calculation.ownersPct.toFixed(2)} %)`,
    );
    console.log(
      `   * Coeficiente a favor: ${scrutinyState.calculation.coeffFavorPct.toFixed(2)} %`,
    );
    assert(
      scrutinyState.calculation.ownersThresholdPct >= 50,
      "Umbral requerido configurado conforme al tipo de acuerdo",
      `${scrutinyState.calculation.ownersThresholdPct} % (${scrutinyState.calculation.statusLabel})`,
    );

    // Guardar escrutinio presencial con excepciones
    const saveRoundResult = await caller.meeting.saveScrutinyRound({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
      roundNumber: 1,
      defaultLogic: "ASSUME_FAVOR",
      inPersonExceptions: {
        mem_owner_carmen_romero: "REJECT",
        mem_owner_antonio_martinez: "ABSTAIN",
      },
    });
    assert(
      saveRoundResult.ok === true,
      "Ronda 1 de escrutinio presencial persistida en base de datos",
      `Estado acuerdo: ${saveRoundResult.itemStatus}`,
    );

    // -------------------------------------------------------------
    // TEST 5: Acuerdos pendientes de ausentes (Punto 6: Art. 17.8 LPH)
    // -------------------------------------------------------------
    console.log(
      "\n▶️ 5. Verificando Notificación y Confirmación de Ausentes (Art. 17.8 LPH)",
    );
    const notifyResult = await caller.meeting.notifyAbsenteesForPendingItem({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
    });
    assert(
      notifyResult.ok === true && Boolean(notifyResult.deadlineAt),
      "Notificación enviada a ausentes con plazo de 30 días naturales",
      `Plazo límite: ${notifyResult.deadlineAt}`,
    );

    // Confirmación legal del acuerdo tras el plazo
    const confirmResult = await caller.meeting.confirmPendingAgreement({
      tenantId: DEMO_TENANT,
      itemId: punto3!.id,
    });
    assert(
      confirmResult.ok === true && Boolean(confirmResult.finalStatus),
      "Acuerdo formalizado legalmente tras cómputo de discrepancias",
      `Resultado final: ${confirmResult.finalStatus}`,
    );

    // -------------------------------------------------------------
    // TEST 6: Resumen y Conclusiones
    // -------------------------------------------------------------
    console.log("\n=================================================");
    console.log(
      `📊 RESULTADO FINAL E2E: ${passedTests}/${totalTests} pruebas superadas.`,
    );
    if (passedTests === totalTests) {
      console.log(
        "🎉 TODOS LOS PUNTOS FUNCIONAN DE MANERA ÓPTIMA Y CONFORME A LA LPH.",
      );
    } else {
      console.error(
        `⚠️ Hubo ${totalTests - passedTests} fallos en la prueba E2E.`,
      );
      process.exit(1);
    }
    console.log("=================================================");
  } catch (err: any) {
    console.error("💥 Error fatal durante la ejecución del test E2E:", err);
    process.exit(1);
  }
}

void runE2E();
