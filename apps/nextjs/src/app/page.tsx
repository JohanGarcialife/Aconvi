import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { AuthShowcase } from "./_components/auth-showcase";
import {
  CreatePostForm,
  PostCardSkeleton,
  PostList,
} from "./_components/posts";

export default function HomePage() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="m-auto w-full max-w-lg">
          <div className="flex flex-col items-center justify-center p-8 bg-card border shadow-sm rounded-2xl">
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">
                Aconvi
              </h1>
              <p className="text-muted-foreground text-sm">
                Software Integral para Administradores de Fincas
              </p>
            </div>
            
            <AuthShowcase />
            
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
