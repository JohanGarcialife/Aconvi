export async function emitWebSocketEvent(
  room: string,
  event: string,
  payload: any,
) {
  // Use WS_URL in production, fallback to localhost in development
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";

  try {
    const res = await fetch(`${baseUrl}/internal/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ room, event, payload }),
    });

    if (!res.ok) {
      console.warn(`[WS Util] Failed to emit event ${event}: ${res.statusText}`);
    }
  } catch (error) {
    console.error(`[WS Util] Error emitting event ${event}:`, error);
  }
}
