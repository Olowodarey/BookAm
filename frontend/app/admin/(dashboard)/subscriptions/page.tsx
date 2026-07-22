"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { adminApi, formatDate, formatNaira } from "@/lib/admin/api";
import type {
  BillingInterval,
  Paginated,
  PlanInput,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/admin/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/admin/ui";

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  MONTHLY: "per month",
  QUARTERLY: "per quarter",
  YEARLY: "per year",
};

const SUB_STATUSES: SubscriptionStatus[] = ["ACTIVE", "EXPIRED", "CANCELLED"];

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [subs, setSubs] = useState<Paginated<Subscription> | null>(null);
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "">(
    "",
  );
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | "new" | null>(
    null,
  );

  const loadPlans = useCallback(async () => {
    try {
      setPlans(await adminApi.listPlans());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    }
  }, []);

  const loadSubs = useCallback(async () => {
    try {
      setSubs(
        await adminApi.listSubscriptions({
          status: statusFilter || undefined,
          page,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load subscriptions");
    }
  }, [statusFilter, page]);

  // Load plans + subscriptions together; re-runs when the filter/page change
  // (loadSubs' identity depends on them). setState happens after the awaits.
  useEffect(() => {
    void (async () => {
      await Promise.all([loadPlans(), loadSubs()]);
    })();
  }, [loadPlans, loadSubs]);

  const activeRevenue = useMemo(
    () =>
      subs?.items
        .filter((s) => s.status === "ACTIVE")
        .reduce((sum, s) => sum + s.plan.priceNaira, 0) ?? 0,
    [subs],
  );

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="BookAm's own SaaS fees — plans coordinators pay for the software. Members' ajo money never passes here."
        action={
          <Button onClick={() => setEditingPlan("new")}>New plan</Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {/* Plans */}
      <section aria-labelledby="plans-heading">
        <h2
          id="plans-heading"
          className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60"
        >
          Plans
        </h2>
        {!plans ? (
          <Spinner />
        ) : plans.length === 0 ? (
          <Card>
            <EmptyState
              title="No plans yet"
              hint="Create your first subscription plan."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold">
                    {plan.name}
                  </h3>
                  <StatusBadge status={plan.active ? "ACTIVE" : "CANCELLED"} />
                </div>
                <p className="mt-2">
                  <span className="font-mono text-2xl font-bold">
                    {formatNaira(plan.priceNaira)}
                  </span>{" "}
                  <span className="text-sm text-muted">
                    {INTERVAL_LABELS[plan.interval]}
                  </span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-ink/80">
                  <li className="flex gap-2">
                    <PlanTick />
                    {plan.maxCircles === null
                      ? "Unlimited circles"
                      : `Up to ${plan.maxCircles} circle${plan.maxCircles === 1 ? "" : "s"}`}
                  </li>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <PlanTick />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
                  <Button
                    variant="secondary"
                    onClick={() => setEditingPlan(plan)}
                  >
                    Edit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Subscriptions table */}
      <section aria-labelledby="subs-heading" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="subs-heading"
            className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60"
          >
            Coordinator subscriptions
          </h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted">
              Active on this page: {formatNaira(activeRevenue)}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as SubscriptionStatus | "");
                setPage(1);
              }}
              aria-label="Filter subscriptions by status"
              className={`${inputClass} w-auto`}
            >
              <option value="">All statuses</option>
              {SUB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Card className="overflow-x-auto">
          {!subs ? (
            <Spinner />
          ) : subs.items.length === 0 ? (
            <EmptyState
              title="No subscriptions"
              hint="Nobody matches this filter yet."
            />
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-ink/60">
                  <th scope="col" className="px-5 py-3 font-bold">Coordinator</th>
                  <th scope="col" className="px-5 py-3 font-bold">Plan</th>
                  <th scope="col" className="px-5 py-3 font-bold">Price</th>
                  <th scope="col" className="px-5 py-3 font-bold">Period</th>
                  <th scope="col" className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.items.map((sub) => (
                  <SubscriptionRow
                    key={sub.id}
                    subscription={sub}
                    onChanged={() => void loadSubs()}
                    onError={setError}
                  />
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {subs && subs.total > subs.pageSize ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-mono text-xs text-muted">
              Page {subs.page} · {subs.total} total
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page * subs.pageSize >= subs.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {editingPlan ? (
        <PlanFormModal
          plan={editingPlan === "new" ? null : editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => {
            setEditingPlan(null);
            void loadPlans();
          }}
        />
      ) : null}
    </div>
  );
}

function PlanTick() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 shrink-0 text-gold"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

function SubscriptionRow({
  subscription,
  onChanged,
  onError,
}: {
  subscription: Subscription;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [updating, setUpdating] = useState(false);

  const changeStatus = async (status: SubscriptionStatus) => {
    if (status === subscription.status) return;
    setUpdating(true);
    try {
      await adminApi.updateSubscriptionStatus(subscription.id, status);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <tr className="border-b border-line/60 last:border-0 hover:bg-white/60">
      <td className="px-5 py-3.5">
        <span className="font-semibold">{subscription.user.name}</span>
        <span className="ml-2 font-mono text-xs text-muted">
          {subscription.user.email}
        </span>
      </td>
      <td className="px-5 py-3.5">{subscription.plan.name}</td>
      <td className="px-5 py-3.5 font-mono text-xs">
        {formatNaira(subscription.plan.priceNaira)}
      </td>
      <td className="px-5 py-3.5 text-muted">
        {formatDate(subscription.periodStart)} –{" "}
        {formatDate(subscription.periodEnd)}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={subscription.status} />
          <select
            value={subscription.status}
            disabled={updating}
            onChange={(e) =>
              void changeStatus(e.target.value as SubscriptionStatus)
            }
            aria-label={`Change status for ${subscription.user.name}'s subscription`}
            className="rounded-lg border border-line bg-white/80 px-2 py-1 text-xs"
          >
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
      </td>
    </tr>
  );
}

function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan ? String(plan.priceNaira) : "");
  const [interval, setInterval] = useState<BillingInterval>(
    plan?.interval ?? "MONTHLY",
  );
  const [maxCircles, setMaxCircles] = useState(
    plan?.maxCircles != null ? String(plan.maxCircles) : "",
  );
  const [features, setFeatures] = useState(plan?.features.join("\n") ?? "");
  const [active, setActive] = useState(plan?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: PlanInput = {
      name: name.trim(),
      priceNaira: Number(price),
      interval,
      maxCircles: maxCircles === "" ? null : Number(maxCircles),
      features: features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      active,
    };

    try {
      if (plan) {
        await adminApi.updatePlan(plan.id, input);
      } else {
        await adminApi.createPlan(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan");
      setSubmitting(false);
    }
  };

  return (
    <Modal title={plan ? `Edit ${plan.name}` : "New plan"} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}

        <Field label="Plan name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Alajo Pro"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₦)">
            <input
              required
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2500"
              className={inputClass}
            />
          </Field>
          <Field label="Billing interval">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as BillingInterval)}
              className={inputClass}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </Field>
        </div>

        <Field label="Max circles (empty = unlimited)">
          <input
            type="number"
            min={1}
            step={1}
            value={maxCircles}
            onChange={(e) => setMaxCircles(e.target.value)}
            placeholder="Unlimited"
            className={inputClass}
          />
        </Field>

        <Field label="Features (one per line)">
          <textarea
            rows={3}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder={"Unlimited members\nWhatsApp reminders"}
            className={inputClass}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-green"
          />
          Plan is active (new coordinators can pick it)
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : plan ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
