"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { useCircle } from "../layout";
import { coordinatorApi } from "@/lib/dashboard/api";
import type { InviteLinkResponse, MemberInfo } from "@/lib/dashboard/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  inputClass,
} from "@/components/admin/ui";
import { CopyButton } from "@/components/dashboard/ui";

export default function MembersPage() {
  const { detail, refresh } = useCircle();
  const { circle } = detail;

  const [order, setOrder] = useState<MemberInfo[]>(detail.members);
  const [baseline, setBaseline] = useState<MemberInfo[]>(detail.members);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<MemberInfo | null>(null);

  // Reset the local draggable order whenever the server list changes
  // (add/remove/refresh) — React's "adjust state during render" pattern.
  if (baseline !== detail.members) {
    setBaseline(detail.members);
    setOrder(detail.members);
  }

  const dirty =
    order.length === detail.members.length &&
    order.some((m, i) => detail.members[i]?.id !== m.id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  const onDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
    setDragIndex(null);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    setError(null);
    try {
      await coordinatorApi.reorderMembers(
        circle.id,
        order.map((m) => m.id),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the new order");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${circle.name} · ${detail.members.length} of ${circle.memberTarget} slots filled. Drag (or use the arrows) to set the payout order.`}
        action={
          <div className="flex gap-2">
            {dirty ? (
              <Button onClick={() => void saveOrder()} disabled={savingOrder}>
                {savingOrder ? "Saving…" : "Save new order"}
              </Button>
            ) : null}
            <Button
              variant={dirty ? "secondary" : "primary"}
              onClick={() => setAdding(true)}
            >
              + Invite member
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <InviteLinkCard
        circleId={circle.id}
        inviteToken={detail.inviteToken}
        onChanged={() => void refresh()}
      />

      <PendingSection
        circleId={circle.id}
        requests={detail.pendingRequests}
        invites={detail.pendingInvites}
        onChanged={() => void refresh()}
      />

      <Card className="mt-4">
        {order.length === 0 ? (
          <EmptyState
            title="No members yet"
            hint="Invite people by email, or share the invite link for them to request to join."
          />
        ) : (
          <ol className="divide-y divide-line/70">
            {order.map((member, index) => (
              <li
                key={member.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, index)}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-3 px-4 py-3 ${
                  dragIndex === index ? "bg-gold/10" : "hover:bg-white/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="cursor-grab select-none font-mono text-muted"
                  title="Drag to reorder"
                >
                  ⠿
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green/10 font-mono text-sm font-bold text-green">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {member.name}
                    {member.hasCollected ? (
                      <span className="ml-2 align-middle">
                        <Badge tone="gold">Collected</Badge>
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate font-mono text-xs text-muted">
                    {member.email ?? member.phone ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${member.name} up the rotation`}
                    className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, index + 1)}
                    disabled={index === order.length - 1}
                    aria-label={`Move ${member.name} down the rotation`}
                    className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setRemoving(member)}
                    aria-label={`Remove ${member.name} from the circle`}
                    className="ml-1 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      className="h-4.5 w-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M3.5 5.5h13M8 5V3.5h4V5M5 5.5l1 11h8l1-11M8.2 8.5v5M11.8 8.5v5" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {adding ? (
        <InviteMemberModal
          circleId={circle.id}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            void refresh();
          }}
        />
      ) : null}

      {removing ? (
        <RemoveMemberModal
          circleId={circle.id}
          member={removing}
          onClose={() => setRemoving(null)}
          onDone={() => {
            setRemoving(null);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function InviteLinkCard({
  circleId,
  inviteToken,
  onChanged,
}: {
  circleId: string;
  inviteToken: string | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<InviteLinkResponse | null>(null);

  const inviteUrl =
    link?.inviteUrl ??
    (inviteToken && typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteToken}`
      : null);

  const run = async (action: "generate" | "disable") => {
    setBusy(true);
    setError(null);
    try {
      if (action === "generate") {
        setLink(await coordinatorApi.generateInvite(circleId));
      } else {
        await coordinatorApi.disableInvite(circleId);
        setLink(null);
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite link action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Invite link
          </p>
          {inviteUrl ? (
            <p className="mt-1 truncate font-mono text-xs text-ink/80">
              {inviteUrl}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Share a link so people can request to join — they sign in and you
              approve each request.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {inviteUrl ? (
            <>
              <CopyButton text={inviteUrl} label="Copy link" />
              <Button
                variant="secondary"
                onClick={() => void run("generate")}
                disabled={busy}
              >
                New link
              </Button>
              <Button
                variant="danger"
                onClick={() => void run("disable")}
                disabled={busy}
              >
                Turn off
              </Button>
            </>
          ) : (
            <Button onClick={() => void run("generate")} disabled={busy}>
              {busy ? "Creating…" : "Create invite link"}
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </Card>
  );
}

/** Pending join requests (from the link) and pending email invites. */
function PendingSection({
  circleId,
  requests,
  invites,
  onChanged,
}: {
  circleId: string;
  requests: MemberInfo[];
  invites: MemberInfo[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0 && invites.length === 0) return null;

  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const who = (m: MemberInfo) => m.email ?? m.name;

  return (
    <Card className="mt-4 px-5 py-4">
      {error ? (
        <div className="mb-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {requests.length > 0 ? (
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Join requests ({requests.length})
          </p>
          <ul className="mt-2 space-y-2">
            {requests.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {who(m)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      void run(m.id, () =>
                        coordinatorApi.approveMember(circleId, m.id),
                      )
                    }
                    disabled={busyId === m.id}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run(m.id, () =>
                        coordinatorApi.removePendingMember(circleId, m.id),
                      )
                    }
                    disabled={busyId === m.id}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {invites.length > 0 ? (
        <div className={requests.length > 0 ? "mt-4" : ""}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-ink/60">
            Invited — waiting for them to accept ({invites.length})
          </p>
          <ul className="mt-2 space-y-2">
            {invites.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {who(m)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void run(m.id, () =>
                      coordinatorApi.removePendingMember(circleId, m.id),
                    )
                  }
                  disabled={busyId === m.id}
                >
                  Cancel invite
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function InviteMemberModal({
  circleId,
  onClose,
  onDone,
}: {
  circleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await coordinatorApi.inviteMember(circleId, email);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite member");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Invite member" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Their Gmail address">
          <input
            type="email"
            required
            pattern="[^@\s]+@gmail\.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@gmail.com"
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-muted">
          We&apos;ll email this Gmail an invite. If they already have a BookAm
          account, it shows on their dashboard to accept; if not, the email
          links them to sign up with this Gmail first. They join the rotation
          once they accept.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Inviting…" : "Send invite"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveMemberModal({
  circleId,
  member,
  onClose,
  onDone,
}: {
  circleId: string;
  member: MemberInfo;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await coordinatorApi.removeMember(circleId, member.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Remove member" onClose={onClose}>
      <p className="text-sm text-ink/80">
        <span className="font-semibold">{member.name}</span> (
        <span className="font-mono text-xs">
          {member.email ?? member.phone ?? ""}
        </span>
        ) will leave the rotation. Their past payment records stay in the book.
      </p>
      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => void submit()} disabled={submitting}>
          {submitting ? "Removing…" : "Remove member"}
        </Button>
      </div>
    </Modal>
  );
}
