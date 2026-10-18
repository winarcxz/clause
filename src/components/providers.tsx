"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { createConfig, http, WagmiProvider } from "wagmi";
import { baseSepolia, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

function ProductProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{ className: "clause-toast" }}
          />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

export function Providers({
  children,
  clerkPublishableKey,
}: {
  children: ReactNode;
  clerkPublishableKey?: string;
}) {
  const product = <ProductProviders>{children}</ProductProviders>;
  return clerkPublishableKey ? (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      {product}
    </ClerkProvider>
  ) : (
    product
  );
}
