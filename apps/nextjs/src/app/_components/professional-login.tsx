"use client";

import { useState } from "react";
import Image from "next/image";
import { Mail, Send, Lock, MousePointerClick, ShieldCheck, Shield } from "lucide-react";

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
        } catch {
          // silent
        }
        attempts++;
        if (attempts > 8) clearInterval(interval);
      }, 1000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al solicitar acceso.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex w-full overflow-hidden rounded-2xl bg-white shadow-2xl"
      style={{ minHeight: "600px" }}
    >
      {/* ─── LEFT PANEL ─────────────────────────────────── */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex flex-1 flex-col p-10 md:p-14">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="Aconvi"
            width={150}
            height={44}
            priority
            className="mb-12 object-contain object-left"
          />

          {/* Heading */}
          <div className="mb-8">
            <span
              className="mb-4 block text-xs font-bold uppercase tracking-widest"
              style={{ color: "#2CD4D9" }}
            >
              Entorno Profesional
            </span>

            <h1
              className="mb-3 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl"
              style={{ color: "#0F1B2B" }}
            >
              Accede a tu<br />espacio de trabajo
            </h1>

            <p className="text-lg" style={{ color: "#64748b" }}>
              Sin contraseñas. Seguro. En segundos.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success — Plan B */}
          {success && (
            <div
              className="mb-5 animate-in fade-in zoom-in rounded-xl border p-5 duration-300"
              style={{ borderColor: "#2CD4D9", backgroundColor: "rgba(44,212,217,0.06)" }}
            >
              <div className="mb-2 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "#2CD4D9" }} />
                <p className="font-semibold" style={{ color: "#0F1B2B" }}>
                  {testLink ? "Enlace generado · Modo Pruebas" : "¡Enlace en camino!"}
                </p>
              </div>
              {testLink ? (
                <div className="pl-8">
                  <p className="mb-3 text-sm text-slate-500">
                    Sin SMTP configurado aún. Haz clic para validar el acceso:
                  </p>
                  <a
                    href={testLink}
                    className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                    style={{ backgroundColor: "#0F1B2B" }}
                  >
                    Entrar a mi entorno →
                  </a>
                </div>
              ) : (
                <p className="pl-8 text-sm text-slate-500">
                  Revisa tu bandeja de entrada. El enlace es válido 10 minutos.
                </p>
              )}
            </div>
          )}

          {/* Form */}
          {!success && (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: "#0F1B2B" }}
                >
                  Email corporativo
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="h-5 w-5" style={{ color: "#2CD4D9" }} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="nombre@tudespacho.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                    className="w-full rounded-xl border py-4 pl-12 pr-4 text-base outline-none transition"
                    style={{
                      borderColor: "#e2e8f0",
                      color: "#0F1B2B",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#2CD4D9")}
                    onBlur={(e) => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !email}
                className="flex w-full items-center justify-center gap-3 rounded-xl py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#2CD4D9" }}
              >
                {loading ? (
                  "Procesando..."
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Recibir enlace seguro
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-2 text-sm" style={{ color: "#94a3b8" }}>
                <Lock className="h-4 w-4" />
                Te enviaremos un enlace válido por 10 minutos.
              </p>
            </div>
          )}

          {/* Divider + Acceso Cifrado */}
          <div className="mt-auto pt-8">
            <div className="mb-4 border-t" style={{ borderColor: "#f1f5f9" }} />
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(44,212,217,0.1)" }}
              >
                <Shield className="h-4 w-4" style={{ color: "#2CD4D9" }} />
              </div>
              <p className="text-sm" style={{ color: "#64748b" }}>
                <strong style={{ color: "#0F1B2B" }}>Acceso cifrado.</strong> Solo tú puedes entrar.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-10 py-4 md:px-14"
          style={{ borderTop: "1px solid #f1f5f9" }}
        >
          <p className="text-xs" style={{ color: "#94a3b8" }}>
            © Aconvi. Todos los derechos reservados.
          </p>
          <div className="flex gap-4 text-xs" style={{ color: "#94a3b8" }}>
            <a href="#" className="transition hover:text-slate-600">Aviso legal</a>
            <a href="#" className="transition hover:text-slate-600">Privacidad</a>
            <a href="#" className="transition hover:text-slate-600">Política de cookies</a>
          </div>
        </div>
      </div>

      {/* ─── RIGHT PANEL ─────────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden lg:block lg:w-1/2"
        style={{ backgroundColor: "#F5F7FA" }}
      >
        {/* Decorative circles — positioned top-right like the reference */}
        <div
          className="absolute"
          style={{
            right: "-80px",
            top: "-80px",
            width: "340px",
            height: "340px",
            borderRadius: "50%",
            border: "1px solid rgba(44,212,217,0.15)",
          }}
        />
        <div
          className="absolute"
          style={{
            right: "-40px",
            top: "-40px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            border: "1px solid rgba(44,212,217,0.12)",
          }}
        />
        {/* Main sphere */}
        <div
          className="absolute"
          style={{
            right: "20px",
            top: "20px",
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #4de8d5, #2CD4D9, #1aabb2)",
            boxShadow: "0 16px 48px rgba(44,212,217,0.35)",
          }}
        />
        {/* Small dot */}
        <div
          className="absolute"
          style={{
            right: "190px",
            top: "50px",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#2CD4D9",
          }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col justify-center px-14 py-20">
          <h2
            className="mb-12 text-3xl font-extrabold leading-tight tracking-tight"
            style={{ color: "#0F1B2B" }}
          >
            Acceso inteligente<br />para equipos modernos
          </h2>

          <div className="flex flex-col gap-8">
            {/* Step 1 */}
            <div className="relative flex items-start gap-5">
              <div
                className="absolute left-6 top-14 z-0"
                style={{
                  height: "calc(100% + 0.5rem)",
                  width: "1px",
                  borderLeft: "2px dashed #d1d5db",
                }}
              />
              <div
                className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <Mail className="h-5 w-5" style={{ color: "#2CD4D9" }} />
              </div>
              <div className="pt-1">
                <h3 className="mb-1 font-bold" style={{ color: "#0F1B2B" }}>
                  1. Recibe el enlace
                </h3>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Te lo enviamos a tu correo corporativo.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex items-start gap-5">
              <div
                className="absolute left-6 top-14 z-0"
                style={{
                  height: "calc(100% + 0.5rem)",
                  width: "1px",
                  borderLeft: "2px dashed #d1d5db",
                }}
              />
              <div
                className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <MousePointerClick className="h-5 w-5" style={{ color: "#2CD4D9" }} />
              </div>
              <div className="pt-1">
                <h3 className="mb-1 font-bold" style={{ color: "#0F1B2B" }}>
                  2. Confirma con un clic
                </h3>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Abre el enlace en este dispositivo.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <Lock className="h-5 w-5" style={{ color: "#2CD4D9" }} />
              </div>
              <div className="pt-1">
                <h3 className="mb-1 font-bold" style={{ color: "#0F1B2B" }}>
                  3. Accede al instante
                </h3>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Entras directamente a tu entorno profesional de trabajo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
