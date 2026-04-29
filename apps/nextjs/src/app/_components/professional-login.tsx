"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { authClient } from "~/auth/client";
import { getDevMagicLink } from "./dev-actions";

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

export function ProfessionalLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "sent" && process.env.NODE_ENV !== "production") {
      // Poll para obtener el link (se escribe al disco asíncronamente)
      interval = setInterval(async () => {
        const url = await getDevMagicLink(email);
        if (url) {
          setDevLink(url);
          clearInterval(interval);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");
    setDevLink(null);

    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/auth-success", // Redirige aquí para separar por Rol
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message || "No pudimos enviar el Magic Link.");
      } else {
        setStatus("sent");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Ocurrió un error inesperado.");
    }
  };

  if (status === "sent") {
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
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(0,189,165,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "28px" }}>📩</span>
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0F1B2B", margin: "0 0 8px" }}>
            Revisa tu correo
          </h2>
          <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px" }}>
            Hemos enviado un Magic Link a <strong>{email}</strong>. Haz clic en el enlace para iniciar sesión.
          </p>
          
          {process.env.NODE_ENV !== "production" && (
            <div style={{
              background: "#f0fdfa",
              border: "1px dashed #14b8a6",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
              width: "100%",
              maxWidth: "400px"
            }}>
              <p style={{ fontSize: "12px", color: "#0f766e", fontWeight: "bold", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🧪 Entorno de Pruebas
              </p>
              {devLink ? (
                <a
                  href={devLink}
                  style={{
                    display: "block",
                    padding: "12px 16px",
                    background: "#00BDA5",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 600,
                    borderRadius: "8px",
                    boxShadow: "0 4px 14px rgba(0,189,165,0.3)"
                  }}
                >
                  🚀 Autenticar Ahora (Simular Click)
                </a>
              ) : (
                <p style={{ fontSize: "14px", color: "#0f766e", opacity: 0.7 }}>
                  Generando enlace mágico...
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => setStatus("idle")}
            style={{
              background: "transparent",
              color: "#00BDA5",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Volver
          </button>
        </div>
        <FooterArea />
      </Card>
    );
  }

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
            gap: "16px",
          }}
        >
          {status === "error" && (
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
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="ej. administrador@fincas.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === "loading"}
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
                opacity: status === "loading" ? 0.7 : 1,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00BDA5")}
              onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 24px",
              background: "#00BDA5",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: status === "loading" ? "not-allowed" : "pointer",
              width: "100%",
              opacity: status === "loading" ? 0.7 : 1,
            }}
          >
            {status === "loading" ? "Enviando..." : "Entrar con Magic Link"}
          </button>
        </form>
      </div>
      <FooterArea />
    </Card>
  );
}
