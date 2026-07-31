"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

/**
 * Safety net so a failed mutation never fails silently and never surfaces as an
 * `unhandledRejection` in the console.
 *
 * Mutations that define their own `onError` keep full control of their copy —
 * we skip those to avoid a duplicate toast.
 */
function createMutationCache(): MutationCache {
  return new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return;
      toast.error(getErrorMessage(error, tt("toast.actionFailed")));
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: createMutationCache(),
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
