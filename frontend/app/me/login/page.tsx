"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/landing/Nav";
import { memberApi, setToken } from "@/lib/member/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";

export default function MemberLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // No role gate: anyone with memberships sees their circles; the server
      // scopes everything by membership.
      const { accessToken } = await memberApi.login(phone, password);
      setToken(accessToken);
      router.replace("/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight">
            BookAm
          </span>
          <span className="rounded-md bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#996414]">
            Member
          </span>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-line bg-white/60 p-6"
        >
          <h1 className="font-display text-lg font-bold">See your circles</h1>
          <p className="text-sm text-muted">
            Check who has paid, whose turn is next, and your own record —
            everything your coordinator sees, you see too.
          </p>

          {error ? <ErrorNote message={error} /> : null}

          <Field label="Phone number">
            <input
              type="tel"
              required
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+2348033333333"
              className={inputClass}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          Your money never touches BookAm — it only keeps the record straight.
        </p>
      </div>
    </div>
  );
}
