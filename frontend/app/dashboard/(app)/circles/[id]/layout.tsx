"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { coordinatorApi } from "@/lib/dashboard/api";
import type { CircleDetail } from "@/lib/dashboard/types";
import { ErrorNote, Spinner } from "@/components/admin/ui";

interface CircleContextValue {
  detail: CircleDetail;
  /** Re-fetches the circle after any action so every screen stays current. */
  refresh: () => Promise<void>;
}

const CircleContext = createContext<CircleContextValue | null>(null);

export function useCircle(): CircleContextValue {
  const value = useContext(CircleContext);
  if (!value) throw new Error("useCircle must be used inside a circle route");
  return value;
}

export default function CircleLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  // Keyed by circle id so switching circles shows a fresh loading state
  // without having to reset state synchronously inside the effect.
  const [loaded, setLoaded] = useState<{
    id: string;
    detail: CircleDetail;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const detail = await coordinatorApi.circleDetail(id);
      setLoaded({ id, detail });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this circle");
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    coordinatorApi.circleDetail(id).then(
      (detail) => {
        if (cancelled) return;
        setLoaded({ id, detail });
        setError(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load this circle");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const detail = loaded?.id === id ? loaded.detail : null;
  if (error) return <ErrorNote message={error} />;
  if (!detail) return <Spinner label="Loading circle…" />;

  return (
    <CircleContext.Provider value={{ detail, refresh }}>
      {children}
    </CircleContext.Provider>
  );
}
