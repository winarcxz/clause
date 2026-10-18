import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      authConfigured={Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
          process.env.CLERK_SECRET_KEY,
      )}
    >
      {children}
    </AppShell>
  );
}
