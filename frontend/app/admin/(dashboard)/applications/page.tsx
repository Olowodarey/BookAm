"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, formatDate } from "@/lib/admin/api";
import type {
  ApplicationStatus,
  CollectorApplication,
  Paginated,
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

const STATUS_FILTERS: { label: string; value: ApplicationStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

type ReviewAction = "approve" | "reject";

export default function ApplicationsPage() {
  const [status, setStatus] = useState<ApplicationStatus | "">("PENDING");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<CollectorApplication> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CollectorApplication | null>(null);
  const [action, setAction] = useState<ReviewAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await adminApi.listApplications({
          status: status || undefined,
          search: search || undefined,
          page,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader
        title="Collector requests"
        subtitle="People wey apply to run circles as coordinators. Approve to promote them."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex rounded-xl border border-line bg-white/60 p-1"
        >
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
              aria-pressed={status === f.value}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === f.value
                  ? "bg-green text-paper"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or phone…"
          aria-label="Search applications by name or phone"
          className={`${inputClass} max-w-xs`}
        />
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <Card className="overflow-x-auto">
        {loading && !data ? (
          <Spinner />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No applications here"
            hint={
              status === "PENDING"
                ? "The queue is clear — nothing dey wait for review."
                : "Try another status filter or search."
            }
          />
        ) : data ? (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-ink/60">
                <th scope="col" className="px-5 py-3 font-bold">Applicant</th>
                <th scope="col" className="px-5 py-3 font-bold">Email</th>
                <th scope="col" className="px-5 py-3 font-bold">Applied</th>
                <th scope="col" className="px-5 py-3 font-bold">Status</th>
                <th scope="col" className="px-5 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((app) => (
                <tr
                  key={app.id}
                  className="border-b border-line/60 last:border-0 hover:bg-white/60"
                >
                  <td className="px-5 py-3.5 font-semibold">
                    {app.applicant.name}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs">
                    {app.applicant.email}
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {formatDate(app.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      variant="secondary"
                      onClick={() => setSelected(app)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Card>

      {data && data.total > data.pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span className="font-mono text-xs">
            Page {data.page} of {totalPages} · {data.total} total
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
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {selected && !action ? (
        <ApplicationDetail
          application={selected}
          onClose={() => setSelected(null)}
          onAction={setAction}
        />
      ) : null}

      {selected && action ? (
        <ReviewModal
          application={selected}
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            setSelected(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ApplicationDetail({
  application,
  onClose,
  onAction,
}: {
  application: CollectorApplication;
  onClose: () => void;
  onAction: (action: ReviewAction) => void;
}) {
  return (
    <Modal title="Collector request" onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <DetailRow label="Applicant" value={application.applicant.name} />
        <DetailRow label="Email" value={application.applicant.email} mono />
        {application.applicant.phone ? (
          <DetailRow label="Phone" value={application.applicant.phone} mono />
        ) : null}
        <DetailRow label="Applied" value={formatDate(application.createdAt)} />
        <div>
          <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Status
          </dt>
          <dd className="mt-1">
            <StatusBadge status={application.status} />
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Applicant&rsquo;s note
          </dt>
          <dd className="mt-1 rounded-xl bg-ink/5 px-3.5 py-2.5 text-ink/80">
            {application.note ?? "No note submitted."}
          </dd>
        </div>
        {application.status !== "PENDING" ? (
          <>
            <DetailRow
              label="Reviewed by"
              value={application.reviewedBy?.name ?? "—"}
            />
            <DetailRow
              label="Reviewed on"
              value={formatDate(application.reviewedAt)}
            />
            <DetailRow
              label="Review note"
              value={application.reviewNote ?? "—"}
            />
          </>
        ) : null}
      </dl>

      {application.status === "PENDING" ? (
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="danger" onClick={() => onAction("reject")}>
            Reject
          </Button>
          <Button onClick={() => onAction("approve")}>Approve</Button>
        </div>
      ) : null}
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
        {label}
      </dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function ReviewModal({
  application,
  action,
  onClose,
  onDone,
}: {
  application: CollectorApplication;
  action: ReviewAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approving = action === "approve";

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (approving) {
        await adminApi.approveApplication(application.id, note || undefined);
      } else {
        await adminApi.rejectApplication(application.id, note || undefined);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={approving ? "Approve collector request" : "Reject collector request"}
      onClose={onClose}
    >
      <p className="text-sm text-ink/80">
        {approving ? (
          <>
            <span className="font-semibold">{application.applicant.name}</span>{" "}
            will become a <span className="font-semibold">coordinator</span>{" "}
            and can start creating circles.
          </>
        ) : (
          <>
            <span className="font-semibold">{application.applicant.name}</span>
            &rsquo;s request will be rejected. Add a reason so the record is
            clear.
          </>
        )}
      </p>

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-4">
        <Field label={approving ? "Review note (optional)" : "Reason (optional)"}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              approving
                ? "e.g. Verified by phone call"
                : "e.g. Could not verify identity"
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={approving ? "primary" : "danger"}
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting
            ? "Working…"
            : approving
              ? "Approve request"
              : "Reject request"}
        </Button>
      </div>
    </Modal>
  );
}
