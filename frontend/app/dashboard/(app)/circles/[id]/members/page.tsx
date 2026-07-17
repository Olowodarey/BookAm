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
              + Add member
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

      <Card className="mt-4">
        {order.length === 0 ? (
          <EmptyState
            title="No members yet"
            hint="Add members by name and phone, or share the invite link."
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
                  <p className="font-mono text-xs text-muted">{member.phone}</p>
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
        <AddMemberModal
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
              Share a link so members can join with their own name and phone.
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

function AddMemberModal({
  circleId,
  onClose,
  onDone,
}: {
  circleId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await coordinatorApi.addMember(circleId, { name, phone });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add member" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Full name">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amina Yusuf"
            className={inputClass}
          />
        </Field>
        <Field label="Phone number">
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+2348012345678"
            className={inputClass}
          />
        </Field>
        <p className="text-xs text-muted">
          New members join at the back of the rotation — drag them into place
          afterwards.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add member"}
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
        <span className="font-mono text-xs">{member.phone}</span>) will leave
        the rotation. Their past payment records stay in the book.
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
