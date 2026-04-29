"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        background: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 2px 24px rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: "480px",
      }}
    >
      {children}
    </div>
  );
}

function LogoArea({ centered = false }: { centered?: boolean }) {
  return (
    <div style={{ padding: "32px 48px 0", textAlign: centered ? "center" : "left" }}>
      <Image
        src="/logo.png"
        alt="Aconvi"
        width={120}
        height={34}
        priority
        style={{ objectFit: "contain", objectPosition: centered ? "center" : "left", display: "inline-block" }}
      />
    </div>
  );
}

function FooterArea() {
  return (
    <div
      style={{
        borderTop: "1px solid #f0f0f0",
        padding: "14px 48px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "auto",
      }}
    >
      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
        © Aconvi. Todos los derechos reservados.
      </span>
      <a href="#" style={{ fontSize: "12px", color: "#00BDA5", textDecoration: "none" }}>
        Ayuda
      </a>
    </div>
  );
}

type LoginStatus = "idle" | "loading" | "awaiting_push" | "approved" | "error" | "user_not_found";

export function ProfessionalLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Poll the server to check if push has been approved
  const pollForApproval = useCallback(async (reqId: string) => {
    try {
      const res = await fetch(`/api/auth/check-push?requestId=${reqId}`);
      if (!res.ok) return;
      const data = await res.json() as { status: string; sessionToken?: string };
      if (data.status === "approved" && data.sessionToken) {
        setStatus("approved");
        // Aseguramos que la sesión se guarde en la cookie que BetterAuth lee
        document.cookie = `better-auth.session_token=${data.sessionToken}; path=/; max-age=${45 * 24 * 60 * 60}`;
        document.cookie = `__Secure-better-auth.session_token=${data.sessionToken}; path=/; secure; max-age=${45 * 24 * 60 * 60}`;
        // Redirect to auth-success to detect role and redirect accordingly
        router.push("/auth-success");
      } else if (data.status === "expired") {
        setStatus("error");
        setErrorMessage("La solicitud de acceso ha expirado. Intenta de nuevo.");
      }
    } catch {
      // Silent fail — keep polling
    }
  }, [router]);

  useEffect(() => {
    if (status !== "awaiting_push" || !requestId) return;
    // Poll every 2 seconds for up to 2 minutes (60 polls)
    if (pollCount >= 60) {
      setStatus("error");
      setErrorMessage("No se recibió respuesta del dispositivo. Inténtalo de nuevo.");
      return;
    }
    const timer = setTimeout(() => {
      void pollForApproval(requestId);
      setPollCount((c) => c + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, requestId, pollCount, pollForApproval]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) return;

    setStatus("loading");
    setErrorMessage("");
    setRequestId(null);
    setPollCount(0);

    try {
      const res = await fetch("/api/auth/request-push-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      const data = await res.json() as { ok: boolean; requestId?: string; error?: string; code?: string };

      if (!res.ok || !data.ok) {
        if (data.code === "USER_NOT_FOUND") {
          setStatus("user_not_found");
          setErrorMessage("Usuario corporativo no encontrado.");
        } else {
          setStatus("error");
          setErrorMessage(data.error ?? "No se pudo iniciar la solicitud de acceso.");
        }
        return;
      }

      setRequestId(data.requestId ?? null);
      setStatus("awaiting_push");
    } catch {
      setStatus("error");
      setErrorMessage("Ocurrió un error inesperado. Intenta de nuevo.");
    }
  };

  // ── Awaiting Push screen ────────────────────────────────────────────────────
  if (status === "awaiting_push" || status === "approved") {
    return (
      <Card>
        <LogoArea centered />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
            textAlign: "center",
          }}
        >
          {/* Animated push icon */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(0,189,165,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
              animation: "pulse 2s infinite",
            }}
          >
            <span style={{ fontSize: "32px" }}>{status === "approved" ? "✅" : "📲"}</span>
          </div>

          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1B2B", margin: "0 0 8px" }}>
            {status === "approved" ? "Acceso aprobado" : "Aprobar desde tu móvil"}
          </h2>
          <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px", maxWidth: "360px" }}>
            {status === "approved"
              ? "Redirigiendo a tu panel..."
              : `Hemos enviado una notificación push a tu dispositivo registrado. Ábrela y confirma el acceso para continuar.`}
          </p>

          {status === "awaiting_push" && (
            <>
              {/* Progress dots */}
              <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#00BDA5",
                      opacity: (pollCount % 3) === i ? 1 : 0.3,
                      transition: "opacity 0.4s",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => { setStatus("idle"); setRequestId(null); setPollCount(0); }}
                style={{
                  background: "transparent",
                  color: "#00BDA5",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                Cancelar y volver
              </button>
            </>
          )}
        </div>
        <FooterArea />
      </Card>
    );
  }

  // ── Main login form ─────────────────────────────────────────────────────────
  return (
    <Card>
      <LogoArea />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 48px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#0F1B2B",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Acceso Corporativo
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "32px", textAlign: "center" }}>
          Introduce tu usuario corporativo para recibir la notificación de acceso.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: "440px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {(status === "error" || status === "user_not_found") && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#dc2626",
                fontSize: "13px",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Usuario corporativo
            </label>
            <input
              type="text"
              placeholder="ej. jluis.admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={status === "loading"}
              autoFocus
              autoComplete="username"
              style={{
                width: "100%",
                padding: "13px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "15px",
                color: "#0F1B2B",
                outline: "none",
                background: "#fff",
                boxSizing: "border-box",
                opacity: status === "loading" ? 0.7 : 1,
                fontFamily: "monospace",
                letterSpacing: "0.5px",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00BDA5")}
              onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
            />
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
              Formato: nombre.apellido &nbsp;·&nbsp; El acceso es gestionado por Aconvi.
            </p>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "14px 24px",
              background: "linear-gradient(135deg, #00BDA5 0%, #0891b2 100%)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: status === "loading" ? "not-allowed" : "pointer",
              width: "100%",
              opacity: status === "loading" ? 0.7 : 1,
              boxShadow: "0 4px 14px rgba(0,189,165,0.3)",
            }}
          >
            {status === "loading" ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                {" "}Verificando...
              </>
            ) : (
              <>
                📲 Solicitar acceso
              </>
            )}
          </button>
        </form>
      </div>
      <FooterArea />
    </Card>
  );
}
