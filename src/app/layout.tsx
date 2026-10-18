import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Clause",
    template: "%s · Clause",
  },
  description:
    "A permission and approval layer for safe AI-initiated onchain execution.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers
          clerkPublishableKey={
            process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          }
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
