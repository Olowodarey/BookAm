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
import { memberApi } from "@/lib/member/api";
import type { MemberCircleDetail } from "@/lib/member/types";
import { ErrorNote, Spinner } from "@/components/admin/ui";

interface MemberCircleContextValue {
  detail: MemberCircleDetail;
  /** Re-fetches after my receipt upload / appeal actions. */
  refresh: () => Promise<void>;
}

const MemberCircleContext = createContext<MemberCircleContextValue | null>(
  null,
);

export function useMemberCircle(): MemberCircleContextValue {
  const value = useContext(MemberCircleContext);
  if (!value)
    throw new Error("useMemberCircle must be used inside a circle route");
  return value;
}

export default function MemberCircleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  // Keyed by circle id so switching circles shows a fresh loading state.
  const [loaded, setLoaded] = useState<{
    id: string;
    detail: MemberCircleDetail;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const detail = await memberApi.circleDetail(id);
      setLoaded({ id, detail });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this circle");
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    memberApi.circleDetail(id).then(
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
  if (!detail) return <Spinner label="Opening the book…" />;

  return (
    <MemberCircleContext.Provider value={{ detail, refresh }}>
      {children}
    </MemberCircleContext.Provider>
  );
}
