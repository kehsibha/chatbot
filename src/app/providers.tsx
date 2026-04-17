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
            // Local SQLite + same-tab UI: treat server reads as fresh longer so
            // route changes reuse cache and feel instant unless invalidated.
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
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
