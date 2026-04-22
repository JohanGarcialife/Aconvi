"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Mail, Send, Lock, LayoutGrid, CheckCircle2 } from "lucide-react";

import { authClient } from "~/auth/client";
import { useTRPC } from "~/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

export function ProfessionalLogin() {
  const router = useRouter();
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

      // Interceptor Plan B: Polling for the test link
      let attempts = 0;
      const interval = setInterval(async () => {
        try {
          const url = (await queryClient.fetchQuery(
            trpc.auth.getLatestMagicLink.queryOptions({ email })
          )) as string | null | undefined;
          
          if (url && typeof url === "string") {
            setTestLink(url);
            clearInterval(interval);
          }
        } catch (err) {
          // silent
        }
        attempts++;
        if (attempts > 5) clearInterval(interval); // give up after 5 tries
      }, 1000);

    } catch (err: any) {
      setError(err.message || "Error al solicitar acceso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col lg:flex-row h-full min-h-[600px] shadow-2xl rounded-3xl overflow-hidden bg-white border border-slate-100">
      
      {/* LEFT SIDE - LOGIN FORM */}
      <div className="w-full lg:w-1/2 p-10 md:p-16 flex flex-col justify-between">
        
        {/* Header / Logo */}
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <LayoutGrid className="text-white h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Aconvi
            </h1>
          </div>
          
          <span className="text-xs font-bold tracking-widest text-[#00bda5] uppercase mb-4 block">
            Entorno Profesional
          </span>
          
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Accede a tu<br />espacio de trabajo
          </h2>
          
          <p className="text-lg text-slate-500 mb-10">
            Sin contraseñas. Seguro. En segundos.
          </p>
        </div>

        {/* Form Body */}
        <div className="w-full max-w-md">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
              {error}
            </div>
          )}

          {success && testLink && (
             <div className="mb-6 rounded-xl bg-[#00bda5]/10 p-5 border border-[#00bda5]/20 animate-in fade-in zoom-in duration-300">
             <div className="flex gap-3 mb-2">
               <CheckCircle2 className="text-[#00bda5] h-5 w-5 shrink-0" />
               <p className="font-semibold text-slate-800">Modo Pruebas (Sin SMTP)</p>
             </div>
             <p className="text-sm text-slate-600 mb-4 pl-8">
               Como no hay correos configurados, haz clic aquí para validar tu ingreso:
             </p>
             <div className="pl-8">
               <a href={testLink} className="inline-flex py-2 px-4 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                 Entrar a mi entorno →
               </a>
             </div>
           </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="email" className="text-sm font-bold text-slate-700 mb-2 block">
                  Email corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@tudespacho.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-12 py-6 text-base bg-slate-50/50 border-slate-200 focus-visible:ring-[#00bda5] rounded-xl"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full py-6 text-base font-semibold bg-[#00bda5] hover:bg-[#00a38e] text-white rounded-xl shadow-lg shadow-[#00bda5]/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Procesando..." : (
                  <>
                    <Send className="h-5 w-5" />
                    Recibir enlace seguro
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Lock className="h-4 w-4" />
            <p>Te enviaremos un enlace válido por 10 minutos.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-full">
              <Lock className="h-4 w-4" />
            </div>
            <span className="font-medium"><strong>Acceso cifrado.</strong> Solo tú puedes entrar.</span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600 transition">Aviso legal</a>
            <a href="#" className="hover:text-slate-600 transition">Privacidad</a>
            <a href="#" className="hover:text-slate-600 transition">Cookies</a>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - ILLUSTRATION */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#f0fcf9] to-[#e6f7f4] relative p-16 flex-col justify-center overflow-hidden">
        
        {/* Decorative Spheres */}
        <div className="absolute top-20 right-20 w-64 h-64 border border-[#00bda5]/10 rounded-full"></div>
        <div className="absolute top-10 right-10 w-80 h-80 border border-[#00bda5]/10 rounded-full"></div>
        <div className="absolute top-36 right-36 w-32 h-32 bg-gradient-to-tr from-[#00bda5] to-emerald-300 rounded-full opacity-80 blur-[2px] shadow-2xl shadow-[#00bda5]/50"></div>
        <div className="absolute top-16 right-64 w-4 h-4 bg-[#00bda5] rounded-full blur-[1px]"></div>

        <div className="relative z-10 max-w-md">
          <h3 className="text-3xl font-extrabold text-slate-900 mb-12 tracking-tight">
            Acceso inteligente <br />para equipos modernos
          </h3>

          <div className="flex flex-col gap-8">
            <div className="flex gap-6 relative">
              <div className="absolute left-6 top-14 bottom-[-2rem] w-px border-l-2 border-dashed border-slate-200"></div>
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100 z-10">
                <Mail className="h-5 w-5 text-[#00bda5]" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg mb-1">1. Recibe el enlace</h4>
                <p className="text-slate-500">Te lo enviamos a tu correo corporativo de forma encriptada.</p>
              </div>
            </div>

            <div className="flex gap-6 relative">
              <div className="absolute left-6 top-14 bottom-[-2rem] w-px border-l-2 border-dashed border-slate-200"></div>
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100 z-10">
                <Send className="h-5 w-5 text-[#00bda5]" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg mb-1">2. Confirma con un clic</h4>
                <p className="text-slate-500">Abre el enlace en este dispositivo sin necesidad de claves.</p>
              </div>
            </div>

            <div className="flex gap-6 relative">
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100 z-10">
                <Lock className="h-5 w-5 text-[#00bda5]" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg mb-1">3. Accede al instante</h4>
                <p className="text-slate-500">Entras directamente a tu entorno profesional de trabajo.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
