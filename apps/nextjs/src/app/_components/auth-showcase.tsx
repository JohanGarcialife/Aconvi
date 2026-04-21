"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";

import { authClient } from "~/auth/client";
import { useTRPC } from "~/trpc/react";
import { useQueryClient } from "@tanstack/react-query";

export function AuthShowcase() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [testCode, setTestCode] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isPending) {
    return <div className="text-center">Cargando...</div>;
  }

  if (session) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="text-center text-2xl">
          Conectado como <span className="font-bold">{session.user.name || session.user.phoneNumber}</span>
        </p>
        <Button
          size="lg"
          variant="secondary"
          onClick={async () => {
            await authClient.signOut();
            router.refresh();
          }}
        >
          Cerrar Sesión
        </Button>
        <Button
          size="lg"
          onClick={() => {
            router.push("/dashboard");
          }}
        >
          Ir al Panel de AF
        </Button>
      </div>
    );
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTestCode(null);
    setLoading(true);
    try {
      const { data, error } = await authClient.phoneNumber.sendOtp({
        phoneNumber,
      });
      if (error) throw error;
      
      // If it's the test number, wait a bit for the DB to save and then fetch it
      if (phoneNumber === "+34600000000" || phoneNumber === "+34 600 000 000") {
        setTimeout(async () => {
          try {
            const code = await queryClient.fetchQuery(
              trpc.auth.getLatestOTP.queryOptions({ phoneNumber })
            );
            if (code) setTestCode(code.split(":")[0]);
          } catch (e) {
            console.error("Failed to fetch test code", e);
          }
        }, 1500);
      }

      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Error al enviar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error } = await authClient.phoneNumber.verify({
        phoneNumber,
        code: otp,
      });
      if (error) throw error;
      // Una vez validado, ir a dashboard de incidencias
      router.push("/incidents");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Código incorrecto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-center text-xl font-bold tracking-tight">Acceso a Aconvi</h2>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      
      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-sm font-medium">
              Número de teléfono
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="+34 600 000 000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\s+/g, ""))}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando..." : "Enviar código por SMS"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="otp" className="text-sm font-medium">
              Código de verificación
            </label>
            <Input
              id="otp"
              type="text"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
            />
          </div>
          {testCode && (
            <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
              <p className="font-medium">Modo Pruebas:</p>
              <p>Tu código es: <span className="text-lg font-bold tracking-widest">{testCode}</span></p>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Verificando..." : "Verificar y entrar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep("phone")}
            className="w-full text-sm"
          >
            Atrás
          </Button>
        </form>
      )}
    </div>
  );
}
