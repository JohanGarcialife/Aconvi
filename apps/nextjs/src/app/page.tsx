import { HydrateClient } from "~/trpc/server";
import { ProfessionalLogin } from "./_components/professional-login";

export default function HomePage() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen bg-slate-50 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-6xl mx-auto">
          <ProfessionalLogin />
        </div>
      </main>
    </HydrateClient>
  );
}
