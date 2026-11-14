"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {AuthSessionProvider} from '@/components/auth/auth-session';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  }));

  return <QueryClientProvider client={queryClient}><AuthSessionProvider>{children}</AuthSessionProvider></QueryClientProvider>;
}

