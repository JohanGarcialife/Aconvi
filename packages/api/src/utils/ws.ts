export async function emitWebSocketEvent(
  room: string,
  event: string,
  payload: any,
) {
  // Use WS_URL in production, fallback to localhost in development
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
  const secret = process.env.WS_INTERNAL_SECRET || "aconvi-dev";

  // Translate event name and build proper data envelope for websocket server routing
  let wsEvent = event;
  let wsData: any = {};

  if (event === "incident-updated" || event === "incident-created") {
    wsEvent = "notify-incident-updated";
    wsData = {
      room: `tenant:${room}`,
      id: payload.id,
      status: payload.status,
      tenantId: room,
      ...payload,
    };
  } else if (event === "notice-published") {
    wsEvent = "notify-new-notice";
    wsData = {
      room: `tenant:${room}`,
      noticeId: payload.id,
      tenantId: room,
      type: payload.type,
      title: payload.title,
      ...payload,
    };
  } else {
    // General fallback
    if (room.startsWith("org_")) {
      wsData = {
        room: `tenant:${room}`,
        ...payload,
      };
    } else {
      wsData = {
        userId: room,
        ...payload,
      };
    }
  }

  try {
    const res = await fetch(`${baseUrl}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ event: wsEvent, data: wsData }),
      signal: AbortSignal.timeout(2000),
    });

    if (!res.ok) {
      console.warn(`[WS Util] Failed to emit event ${wsEvent}: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error(`[WS Util] Error emitting event ${wsEvent}:`, error);
  }
}
