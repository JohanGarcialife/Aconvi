import { HydrateClient } from "~/trpc/server";
import { ProfessionalLogin } from "./_components/professional-login";

export default function HomePage() {
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
