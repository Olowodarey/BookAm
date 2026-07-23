"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, formatDate } from "@/lib/admin/api";
import type { WaitlistList } from "@/lib/admin/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
} from "@/components/admin/ui";

// Poll interval for the "real time" feel — new signups appear within 5s.
const REFRESH_MS = 5000;

export default function WaitlistPage() {
  const [data, setData] = useState<WaitlistList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const prevTotal = useRef<number | null>(null);
  const [justArrived, setJustArrived] = useState(0);

  const load = useCallback(async () => {
    try {
      const next = await adminApi.waitlist();
      setError(null);
      // Flash the count when new entries land since the last poll.
      if (prevTotal.current !== null && next.total > prevTotal.current) {
        setJustArrived(next.total - prevTotal.current);
        setTimeout(() => setJustArrived(0), 2500);
      }
      prevTotal.current = next.total;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the waitlist");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const copyEmails = async () => {
    if (!data) return;
    const text = data.entries.map((e) => e.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const downloadCsv = () => {
    if (!data) return;
    const rows = [
      "email,source,joined",
      ...data.entries.map(
        (e) => `${e.email},${e.source ?? ""},${e.createdAt}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([rows], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookam-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Waitlist"
        subtitle="Early-access emails from the landing page — updates live as people sign up."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-green bg-green/5 px-4 py-2 font-semibold text-green">
          <span
            className="h-2 w-2 rounded-full bg-green"
            aria-hidden="true"
          />
          {data ? data.total : "—"} on the list
        </span>
        {justArrived > 0 ? (
          <span
            role="status"
            className="rounded-full bg-gold/15 px-3 py-1 text-sm font-semibold text-[#996414]"
          >
            +{justArrived} just now
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            onClick={() => void copyEmails()}
            disabled={!data || data.entries.length === 0}
          >
            {copied ? "Copied ✓" : "Copy emails"}
          </Button>
          <Button
            variant="secondary"
            onClick={downloadCsv}
            disabled={!data || data.entries.length === 0}
          >
            Download CSV
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {!data ? (
          <Spinner />
        ) : data.entries.length === 0 ? (
          <EmptyState
            title="No signups yet"
            hint="Emails dropped on the landing page will appear here in real time."
          />
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-ink/60">
                <th scope="col" className="px-5 py-3 font-bold">
                  Email
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Source
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-line/60 last:border-0 hover:bg-white/60"
                >
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold">
                    {entry.email}
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {entry.source ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {formatDate(entry.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
