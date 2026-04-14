"use client";
/**
 * Client-side providers. Everything under the root layout gets wrapped in:
 *   - TanStack Query (data fetching + cache invalidation when tools fire)
 *   - AgentProvider (holds the streaming agent state + send function)
 */
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentProvider } from "@/components/agent-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AgentProvider>{children}</AgentProvider>
    </QueryClientProvider>
  );
}
