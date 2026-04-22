"use client";

import { useState } from "react";
import Image from "next/image";

import { authClient } from "~/auth/client";
import { useTRPC } from "~/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

export function ProfessionalLogin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [testLink, setTestLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setError("");
    setSuccess(false);
    setTestLink(null);
    setLoading(true);

    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: "/incidents",
      });
      if (error) throw error;
      setSuccess(true);

      let attempts = 0;
      const interval = setInterval(async () => {
        try {
          const url = (await queryClient.fetchQuery(
            trpc.auth.getLatestMagicLink.queryOptions({ email }),
          )) as string | null | undefined;
          if (url && typeof url === "string") {
            setTestLink(url);
            clearInterval(interval);
          }
        } catch { /* silent */ }
        if (++attempts > 8) clearInterval(interval);
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al solicitar acceso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      width: "100%",
      maxWidth: "1060px",
      minHeight: "600px",
      background: "#ffffff",
      borderRadius: "16px",
      boxShadow: "0 4px 40px rgba(0,0,0,0.08)",
      overflow: "hidden",
    }}>

      {/* ═══════════════════════════ LEFT PANEL ═══════════════════════════ */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: "54%",
        background: "#ffffff",
        padding: "56px 64px 0 64px",
      }}>

        {/* Logo */}
        <div style={{ marginBottom: "40px" }}>
          <Image
            src="/logo.png"
            alt="Aconvi"
            width={160}
            height={46}
            priority
            style={{ objectFit: "contain", objectPosition: "left" }}
          />
        </div>

        {/* Tag */}
        <div style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#00BDA5",
          marginBottom: "16px",
        }}>
          Entorno Profesional
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: "42px",
          fontWeight: 800,
          lineHeight: 1.15,
          color: "#0F1B2B",
          margin: "0 0 12px 0",
          letterSpacing: "-0.5px",
        }}>
          Accede a tu<br />espacio de trabajo
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: "16px",
          color: "#6b7280",
          margin: "0 0 32px 0",
        }}>
          Sin contraseñas. Seguro. En segundos.
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "10px",
            padding: "12px 16px",
            color: "#dc2626",
            fontSize: "14px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        {/* Test mode success box */}
        {success && (
          <div style={{
            background: "rgba(0,189,165,0.06)",
            border: "1px solid #00BDA5",
            borderRadius: "12px",
            padding: "18px",
            marginBottom: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BDA5" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ fontWeight: 600, color: "#0F1B2B" }}>
                {testLink ? "Enlace generado · Modo Pruebas" : "¡Enlace en camino!"}
              </span>
            </div>
            {testLink ? (
              <div style={{ paddingLeft: "30px" }}>
                <p style={{ color: "#6b7280", fontSize: "13px", marginBottom: "12px" }}>
                  Sin SMTP configurado aún. Haz clic para acceder:
                </p>
                <a href={testLink} style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  background: "#0F1B2B",
                  color: "#fff",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}>
                  Entrar a mi entorno →
                </a>
              </div>
            ) : (
              <p style={{ paddingLeft: "30px", color: "#6b7280", fontSize: "13px" }}>
                Revisa tu bandeja. El enlace caduca en 10 minutos.
              </p>
            )}
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Label */}
            <label style={{ fontSize: "13px", fontWeight: 700, color: "#0F1B2B" }}>
              Email corporativo
            </label>

            {/* Input */}
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#00BDA5",
                display: "flex",
                alignItems: "center",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input
                type="email"
                placeholder="nombre@tudespacho.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px 14px 48px",
                  border: "1.5px solid #00BDA5",
                  borderRadius: "10px",
                  fontSize: "15px",
                  color: "#0F1B2B",
                  outline: "none",
                  background: "#fff",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "15px 24px",
                background: "#00BDA5",
                border: "none",
                borderRadius: "10px",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {loading ? "Procesando..." : "Recibir enlace seguro"}
            </button>

            {/* Hint */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              justifyContent: "center",
              color: "#9ca3af",
              fontSize: "12px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Te enviaremos un enlace válido por 10 minutos.
            </div>
          </form>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Divider + Acceso cifrado */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00BDA5" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: 0 }}>
              <strong style={{ color: "#0F1B2B" }}>Acceso cifrado.</strong> Solo tú puedes entrar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: "1px solid #e5e7eb",
          marginTop: "24px",
          padding: "16px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            © Aconvi. Todos los derechos reservados.
          </span>
          <div style={{ display: "flex", gap: "20px" }}>
            {["Aviso legal", "Privacidad", "Política de cookies"].map((link) => (
              <a key={link} href="#" style={{ fontSize: "12px", color: "#9ca3af", textDecoration: "none" }}>
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════ RIGHT PANEL ══════════════════════════ */}
      <div style={{
        position: "relative",
        width: "46%",
        background: "#f0faf8",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "56px 52px",
      }}>

        {/* Decorative ring (circle outline) — top right */}
        <div style={{
          position: "absolute",
          top: "-40px",
          right: "-60px",
          width: "240px",
          height: "240px",
          borderRadius: "50%",
          border: "1.5px solid rgba(0,189,165,0.18)",
          pointerEvents: "none",
        }} />

        {/* Gradient sphere */}
        <div style={{
          position: "absolute",
          top: "30px",
          right: "40px",
          width: "110px",
          height: "110px",
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #5de8d5, #1bc4ac, #0da090)",
          boxShadow: "0 8px 32px rgba(0,189,165,0.30)",
          pointerEvents: "none",
        }} />

        {/* Small dot */}
        <div style={{
          position: "absolute",
          top: "52px",
          right: "168px",
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "#00BDA5",
          pointerEvents: "none",
        }} />

        {/* Heading */}
        <h2 style={{
          fontSize: "24px",
          fontWeight: 800,
          color: "#0F1B2B",
          lineHeight: 1.3,
          margin: "0 0 40px 0",
        }}>
          Acceso inteligente<br />para equipos modernos
        </h2>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

          {/* Step 1 */}
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fff",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BDA5" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
              <div style={{ width: "1px", height: "32px", borderLeft: "2px dashed #d1d5db", margin: "4px 0" }} />
            </div>
            <div style={{ paddingTop: "12px", paddingBottom: "0" }}>
              <div style={{ fontWeight: 700, color: "#0F1B2B", marginBottom: "4px" }}>1. Recibe el enlace</div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Te lo enviamos a tu correo corporativo.</div>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fff",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BDA5" strokeWidth="2">
                  <path d="M5 12h14"/>
                  <path d="M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div style={{ width: "1px", height: "32px", borderLeft: "2px dashed #d1d5db", margin: "4px 0" }} />
            </div>
            <div style={{ paddingTop: "12px" }}>
              <div style={{ fontWeight: 700, color: "#0F1B2B", marginBottom: "4px" }}>2. Confirma con un clic</div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Abre el enlace en este dispositivo.</div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#fff",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00BDA5" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
            </div>
            <div style={{ paddingTop: "12px" }}>
              <div style={{ fontWeight: 700, color: "#0F1B2B", marginBottom: "4px" }}>3. Accede al instante</div>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Entras directamente a tu entorno profesional de trabajo.</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
