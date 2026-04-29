import { HydrateClient } from "~/trpc/server";
import { ProfessionalLogin } from "../_components/professional-login";

export const metadata = {
  title: "Acceso al Portal | Aconvi",
  description: "Inicia sesión en el portal de administración de Aconvi.",
};

export default function LoginPage() {
  return (
    <HydrateClient>
      <main
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <ProfessionalLogin />
        </div>
      </main>
    </HydrateClient>
  );
}
