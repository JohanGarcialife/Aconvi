"use client";

import { useState } from "react";
import Image from "next/image";
import { Mail, Send, Lock, MousePointerClick, ShieldCheck } from "lucide-react";

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

      // Plan B interceptor: poll for the test link
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
    <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xl shadow-slate-200/50 lg:h-[640px] lg:flex-row">
      {/* ─── LEFT SIDE ─────────────────────────────────────────── */}
      <div className="flex w-full flex-col justify-between p-10 md:p-14 lg:w-1/2">
        {/* Logo */}
        <div>
          <Image
            src="/logo.png"
            alt="Aconvi"
            width={160}
            height={48}
            priority
            className="mb-12 object-contain"
          />

          <span
            className="mb-5 block text-xs font-bold uppercase tracking-widest"
            style={{ color: "#2CD4D9" }}
          >
            Entorno Profesional
          </span>

          <h1
            className="mb-4 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl"
            style={{ color: "#0F1B2B" }}
          >
            Accede a tu<br />espacio de trabajo
          </h1>

          <p className="mb-10 text-lg text-slate-500">
            Sin contraseñas. Seguro. En segundos.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success — Plan B interceptor link */}
          {success && (
            <div
              className="mb-5 animate-in fade-in zoom-in rounded-xl border p-5 duration-300"
              style={{
                borderColor: "#2CD4D9",
                backgroundColor: "rgba(44,212,217,0.06)",
              }}
            >
              <div className="mb-2 flex items-center gap-3">
                <ShieldCheck
                  className="h-5 w-5 shrink-0"
                  style={{ color: "#2CD4D9" }}
                />
                <p
                  className="font-semibold"
                  style={{ color: "#0F1B2B" }}
                >
                  {testLink
                    ? "Enlace generado · Modo Pruebas"
                    : "¡Enlace en camino!"}
                </p>
              </div>
              {testLink ? (
                <div className="pl-8">
                  <p className="mb-3 text-sm text-slate-500">
                    Sin SMTP configurado aún. Haz clic para validar el
                    acceso directo:
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
                  Revisa tu bandeja de entrada. El enlace es válido 10
                  minutos.
                </p>
              )}
            </div>
          )}

          {/* Form */}
          {!success && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Email corporativo
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="nombre@tudespacho.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-4 pl-12 pr-4 text-base text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#2CD4D9] focus:ring-2 focus:ring-[#2CD4D9]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl py-4 text-base font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: "#2CD4D9",
                  boxShadow: "0 8px 24px rgba(44,212,217,0.25)",
                }}
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
            </form>
          )}

          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Lock className="h-4 w-4" />
            Te enviaremos un enlace válido por 10 minutos.
          </p>
        </div>

        {/* Footer */}
        <div className="mt-10 flex flex-col gap-4 border-t border-slate-100 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div
              className="rounded-full p-1.5"
              style={{ backgroundColor: "rgba(44,212,217,0.12)" }}
            >
              <ShieldCheck
                className="h-4 w-4"
                style={{ color: "#2CD4D9" }}
              />
            </div>
            <span>
              <strong>Acceso cifrado.</strong> Solo tú puedes entrar.
            </span>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <a href="#" className="transition hover:text-slate-600">
              Aviso legal
            </a>
            <a href="#" className="transition hover:text-slate-600">
              Privacidad
            </a>
            <a href="#" className="transition hover:text-slate-600">
              Cookies
            </a>
          </div>
        </div>
      </div>

      {/* ─── RIGHT SIDE ────────────────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden p-14 lg:flex lg:w-1/2 lg:flex-col lg:justify-center"
        style={{ backgroundColor: "#F5F7FA" }}
      >
        {/* Decorative orbs */}
        <div
          className="absolute right-10 top-10 h-72 w-72 rounded-full border"
          style={{ borderColor: "rgba(44,212,217,0.12)" }}
        />
        <div
          className="absolute right-4 top-4 h-80 w-80 rounded-full border"
          style={{ borderColor: "rgba(44,212,217,0.08)" }}
        />
        <div
          className="absolute right-24 top-24 h-36 w-36 rounded-full shadow-2xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, #2CD4D9, #1ab8bc)",
            boxShadow: "0 20px 60px rgba(44,212,217,0.45)",
          }}
        />
        <div
          className="absolute right-56 top-16 h-4 w-4 rounded-full"
          style={{ backgroundColor: "#2CD4D9" }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-sm">
          <h2
            className="mb-12 text-3xl font-extrabold leading-tight tracking-tight"
            style={{ color: "#0F1B2B" }}
          >
            Acceso inteligente<br />para equipos modernos
          </h2>

          <div className="flex flex-col gap-8">
            {/* Step 1 */}
            <div className="relative flex gap-5">
              <div className="absolute bottom-[-2.5rem] left-6 top-14 w-px border-l-2 border-dashed border-slate-200" />
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                <Mail className="h-5 w-5" style={{ color: "#2CD4D9" }} />
              </div>
              <div>
                <h3
                  className="mb-1 text-lg font-bold"
                  style={{ color: "#0F1B2B" }}
                >
                  1. Recibe el enlace
                </h3>
                <p className="text-slate-500">
                  Te lo enviamos a tu correo corporativo.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative flex gap-5">
              <div className="absolute bottom-[-2.5rem] left-6 top-14 w-px border-l-2 border-dashed border-slate-200" />
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                <MousePointerClick
                  className="h-5 w-5"
                  style={{ color: "#2CD4D9" }}
                />
              </div>
              <div>
                <h3
                  className="mb-1 text-lg font-bold"
                  style={{ color: "#0F1B2B" }}
                >
                  2. Confirma con un clic
                </h3>
                <p className="text-slate-500">
                  Abre el enlace en este dispositivo.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                <Lock className="h-5 w-5" style={{ color: "#2CD4D9" }} />
              </div>
              <div>
                <h3
                  className="mb-1 text-lg font-bold"
                  style={{ color: "#0F1B2B" }}
                >
                  3. Accede al instante
                </h3>
                <p className="text-slate-500">
                  Entras directamente a tu entorno profesional de trabajo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <p className="absolute bottom-6 left-14 text-xs text-slate-400">
          © Aconvi. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
