"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

type LoginState = "IDLE" | "LOADING" | "WAITING" | "SUCCESS" | "TIMEOUT";

function DotsSpinner() {
  return (
    <div style={{ position: "relative", width: "72px", height: "72px" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            backgroundColor: "#00BDA5",
            transform: `rotate(${i * 30}deg) translateY(-28px) translateX(-3.5px)`,
            opacity: (i + 1) / 12,
          }}
        />
      ))}
    </div>
  );
}

function CircleSpinner() {
  return (
    <div
      style={{
        width: "44px",
        height: "44px",
        border: "3px solid #e5e7eb",
        borderTopColor: "#00BDA5",
        borderRadius: "50%",
        animation: "acv-spin 0.8s linear infinite",
      }}
    />
  );
}

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
      <style>{`
        @keyframes acv-spin { to { transform: rotate(360deg); } }
        @keyframes acv-progress { from { width: 0%; } to { width: 100%; } }
      `}</style>
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

export function ProfessionalLogin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [state, setState] = useState<LoginState>("IDLE");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // tRPC mutations
  const requestAccess = useMutation(
    trpc.auth.requestPushAccess.mutationOptions(),
  );
  const cancelAccess = useMutation(
    trpc.auth.cancelPushAccess.mutationOptions(),
  );
  const confirmAccess = useMutation(
    trpc.auth.confirmPushAccess.mutationOptions(),
  );

  const startPolling = useCallback(
    (token: string) => {
      setState("WAITING");
      const startedAt = Date.now();
      const TIMEOUT_MS = 3 * 60 * 1000;

      pollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > TIMEOUT_MS) {
          stopPolling();
          setState("TIMEOUT");
          return;
        }
        try {
          const result = await queryClient.fetchQuery(
            trpc.auth.pollPushStatus.queryOptions({ token }),
          );
          if (result.status === "CONFIRMED") {
            stopPolling();
            setState("SUCCESS");
            setTimeout(() => router.push("/incidents"), 1800);
          } else if (
            result.status === "EXPIRED" ||
            result.status === "CANCELLED"
          ) {
            stopPolling();
            setState("TIMEOUT");
          }
        } catch {
          // silent
        }
      }, 2000);
    },
    [queryClient, router, stopPolling, trpc.auth.pollPushStatus],
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const u = username.trim();
    if (!u) return;
    setError("");
    setState("LOADING");

    try {
      const result = await requestAccess.mutateAsync({
        corporateUsername: u,
        loginUserAgent: navigator.userAgent,
      });
      setPendingToken(result.token);
      startPolling(result.token);
    } catch (err: unknown) {
      setState("IDLE");
      setError(
        err instanceof Error ? err.message : "Error al iniciar sesión.",
      );
    }
  };

  const handleCancel = async () => {
    stopPolling();
    if (pendingToken) {
      try {
        await cancelAccess.mutateAsync({ token: pendingToken });
      } catch {
        /* silent */
      }
    }
    setPendingToken(null);
    setState("IDLE");
  };

  const handleRetry = () => {
    stopPolling();
    setPendingToken(null);
    void handleSubmit();
  };

  // ─── IDLE ──────────────────────────────────────────────────────────────────
  if (state === "IDLE") {
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
              margin: "0 0 32px",
              textAlign: "center",
            }}
          >
            Iniciar sesión
          </h1>

          <form
            onSubmit={handleSubmit}
            style={{
              width: "100%",
              maxWidth: "440px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {error && (
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
                {error}
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
                placeholder="ej. jlopez, af.martinez, proveedor.fontaneria"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
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
                }}
                onFocus={(e) => (e.target.style.borderColor = "#00BDA5")}
                onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
              />
            </div>

            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "14px 24px",
                background: "#00BDA5",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Entrar
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
                color: "#9ca3af",
                fontSize: "13px",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00BDA5"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Confirmación en dispositivo
            </div>
          </form>
        </div>
        <FooterArea />
      </Card>
    );
  }

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (state === "LOADING") {
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
            gap: "20px",
          }}
        >
          <CircleSpinner />
          <p style={{ color: "#9ca3af", fontSize: "15px", margin: 0 }}>
            Iniciando sesión...
          </p>
        </div>
        <FooterArea />
      </Card>
    );
  }

  // ─── WAITING ───────────────────────────────────────────────────────────────
  if (state === "WAITING") {
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
            gap: "24px",
            padding: "40px",
          }}
        >
          <DotsSpinner />
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#0F1B2B",
                margin: "0 0 8px",
              }}
            >
              Confirma en tu dispositivo
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
              Esperando validación
            </p>
          </div>
          <button
            onClick={handleCancel}
            style={{
              color: "#00BDA5",
              background: "none",
              border: "none",
              fontSize: "14px",
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            Cancelar
          </button>
        </div>
        <FooterArea />
      </Card>
    );
  }

  // ─── SUCCESS ───────────────────────────────────────────────────────────────
  if (state === "SUCCESS") {
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
            gap: "20px",
            padding: "40px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(0,189,165,0.10)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00BDA5"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#0F1B2B",
                margin: "0 0 6px",
              }}
            >
              Acceso confirmado
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
              Redirigiendo...
            </p>
          </div>
        </div>
        <div style={{ height: "4px", background: "#e5e7eb" }}>
          <div
            style={{
              height: "4px",
              background: "#00BDA5",
              animation: "acv-progress 1.8s ease-in-out forwards",
              width: "0%",
            }}
          />
        </div>
      </Card>
    );
  }

  // ─── TIMEOUT ───────────────────────────────────────────────────────────────
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
          gap: "20px",
          padding: "40px",
        }}
      >
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            border: "3px solid #f59e0b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{ fontSize: "28px", fontWeight: 800, color: "#f59e0b", lineHeight: 1 }}
          >
            !
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#0F1B2B",
              margin: "0 0 8px",
            }}
          >
            No se ha recibido confirmación
          </h2>
          <p
            style={{
              color: "#9ca3af",
              fontSize: "13px",
              margin: 0,
              maxWidth: "280px",
            }}
          >
            Revisa tu dispositivo e inténtalo de nuevo.
          </p>
        </div>

        <button
          onClick={handleRetry}
          style={{
            padding: "13px 0",
            background: "#00BDA5",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
            maxWidth: "260px",
          }}
        >
          Reintentar
        </button>
        <button
          onClick={() => {
            stopPolling();
            void handleSubmit();
          }}
          style={{
            color: "#00BDA5",
            background: "none",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Enviar de nuevo
        </button>
        <button
          onClick={() => {
            stopPolling();
            setState("IDLE");
            setPendingToken(null);
          }}
          style={{
            color: "#9ca3af",
            background: "none",
            border: "none",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
      <FooterArea />
    </Card>
  );
}
