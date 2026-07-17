"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, formatNaira } from "@/lib/admin/api";
import type { OverviewMetrics } from "@/lib/admin/types";
import {
  Card,
  ErrorNote,
  MetricCard,
  PageHeader,
  Spinner,
} from "@/components/admin/ui";

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .overview()
      .then(setMetrics)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load metrics"),
      );
  }, []);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="How the platform dey do — users, circles and subscriptions at a glance."
      />

      {error ? <ErrorNote message={error} /> : null}
      {!metrics && !error ? <Spinner /> : null}

      {metrics ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Total users"
              value={metrics.totalUsers.toLocaleString()}
            />
            <MetricCard
              label="Coordinators"
              value={metrics.totalCoordinators.toLocaleString()}
              hint="Users running at least the coordinator role"
            />
            <MetricCard
              label="Circles"
              value={metrics.totalCircles.toLocaleString()}
            />
            <MetricCard
              label="Pending applications"
              value={metrics.pendingApplications.toLocaleString()}
              hint="Collector requests waiting for review"
            />
            <MetricCard
              label="Active subscriptions"
              value={metrics.activeSubscriptions.toLocaleString()}
            />
            <MetricCard
              label="Subscription revenue"
              value={formatNaira(metrics.activeRevenueNaira)}
              hint="Current period, from active subscription records"
            />
          </div>

          {metrics.pendingApplications > 0 ? (
            <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 border-gold/40 bg-gold/10 px-5 py-4">
              <p className="text-sm">
                <span className="font-semibold">
                  {metrics.pendingApplications} collector{" "}
                  {metrics.pendingApplications === 1
                    ? "request is"
                    : "requests are"}{" "}
                  waiting.
                </span>{" "}
                Review them so new alajos fit start.
              </p>
              <Link
                href="/admin/applications"
                className="rounded-xl bg-green px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-green-deep"
              >
                Review requests
              </Link>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
