"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useMemberCircle } from "../layout";
import { memberApi, formatDate } from "@/lib/member/api";
import type { SwapRequestInfo, SwapStatus } from "@/lib/member/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Spinner,
  inputClass,
  type BadgeTone,
} from "@/components/admin/ui";

const STATUS_TONE: Record<SwapStatus, BadgeTone> = {
  PENDING: "gold",
  ACCEPTED: "gold",
  CONFIRMED: "green",
  DECLINED: "red",
  CANCELLED: "muted",
  REJECTED: "red",
};

const STATUS_LABEL: Record<SwapStatus, string> = {
  PENDING: "Awaiting reply",
  ACCEPTED: "Awaiting coordinator",
  CONFIRMED: "Swapped ✓",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  REJECTED: "Not approved",
};

/**
 * Position swaps: ask a specific member to trade rotation turns. They accept,
 * then the coordinator confirms — and the two positions swap. Everything stays
 * visible to the whole circle as a record.
 */
export default function SwapsPage() {
  const { id: circleId } = useParams<{ id: string }>();
  const { detail } = useMemberCircle();
  const [swaps, setSwaps] = useState<SwapRequestInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    memberApi.listSwaps(circleId).then(
      (list) => {
        setSwaps(list);
        setError(null);
      },
      (e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load swaps"),
    );
  }, [circleId]);

  useEffect(load, [load]);

  const act = async (id: string, action: () => Promise<SwapRequestInfo>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  // Members I could swap with: active roster, not me, not already collected.
  const eligible = useMemo(
    () => detail.members.filter((m) => !m.isMe && !m.hasCollected),
    [detail.members],
  );

  const iHaveActive = swaps?.some(
    (s) => s.isMine && (s.status === "PENDING" || s.status === "ACCEPTED"),
  );
  const canRequest =
    !detail.me.hasCollected && eligible.length > 0 && !iHaveActive;

  const incoming = swaps?.filter((s) => s.canRespond) ?? [];
  const rest = swaps?.filter((s) => !s.canRespond) ?? [];

  return (
    <div>
      <PageHeader
        title="Swaps"
        subtitle="Want a different turn? Ask a member to swap positions. They accept, the coordinator confirms — and you trade places."
        action={
          canRequest ? (
            <Button onClick={() => setCreating(true)}>Request a swap</Button>
          ) : undefined
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      {!swaps ? (
        <Spinner label="Loading swaps…" />
      ) : swaps.length === 0 ? (
        <Card>
          <EmptyState
            title="No swaps yet"
            hint={
              canRequest
                ? "Tap 'Request a swap' to ask a member to trade turns with you."
                : "Swap requests will show here once someone starts one."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {incoming.length > 0 ? (
            <section>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wide text-[#996414]">
                Waiting for your reply
              </p>
              <div className="space-y-3">
                {incoming.map((s) => (
                  <SwapCard
                    key={s.id}
                    swap={s}
                    busy={busyId === s.id}
                    onAccept={() =>
                      act(s.id, () => memberApi.acceptSwap(s.id))
                    }
                    onDecline={() =>
                      act(s.id, () => memberApi.declineSwap(s.id))
                    }
                    onCancel={() => act(s.id, () => memberApi.cancelSwap(s.id))}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="space-y-3">
            {rest.map((s) => (
              <SwapCard
                key={s.id}
                swap={s}
                busy={busyId === s.id}
                onAccept={() => act(s.id, () => memberApi.acceptSwap(s.id))}
                onDecline={() => act(s.id, () => memberApi.declineSwap(s.id))}
                onCancel={() => act(s.id, () => memberApi.cancelSwap(s.id))}
              />
            ))}
          </div>
        </div>
      )}

      {creating ? (
        <RequestSwapModal
          circleId={circleId}
          eligible={eligible}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function SwapCard({
  swap,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  swap: SwapRequestInfo;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="border-2 border-ink bg-white px-5 py-4 shadow-[4px_4px_0_0_rgba(15,90,64,0.10)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">
            {swap.isMine ? "You" : swap.requesterName}
            <span className="mx-1.5 font-mono text-xs font-normal text-muted">
              pos {swap.requesterPosition}
            </span>
            <span className="text-muted">↔</span>{" "}
            {swap.isForMe ? "you" : swap.targetName}
            <span className="ml-1.5 font-mono text-xs font-normal text-muted">
              pos {swap.targetPosition}
            </span>
          </p>
          {swap.note ? (
            <p className="mt-1 text-sm text-ink/80">“{swap.note}”</p>
          ) : null}
          <p className="mt-1 text-xs text-muted">
            Asked {formatDate(swap.createdAt)}
            {swap.decidedByName ? ` · decided by ${swap.decidedByName}` : ""}
          </p>
        </div>
        <Badge tone={STATUS_TONE[swap.status]}>
          {STATUS_LABEL[swap.status]}
        </Badge>
      </div>

      {swap.canRespond || swap.canCancel ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {swap.canRespond ? (
            <>
              <Button onClick={onAccept} disabled={busy}>
                Accept swap
              </Button>
              <Button variant="ghost" onClick={onDecline} disabled={busy}>
                Decline
              </Button>
            </>
          ) : null}
          {swap.canCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel request
            </Button>
          ) : null}
        </div>
      ) : swap.status === "ACCEPTED" ? (
        <p className="mt-2 text-xs text-muted">
          Accepted — waiting for the coordinator to confirm the swap.
        </p>
      ) : null}
    </Card>
  );
}

function RequestSwapModal({
  circleId,
  eligible,
  onClose,
  onCreated,
}: {
  circleId: string;
  eligible: { membershipId: string; name: string; position: number }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      setError("Pick who you'd like to swap with");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await memberApi.createSwap(circleId, targetId, note.trim() || undefined);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request");
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Request a position swap" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="grid gap-3">
        {error ? <ErrorNote message={error} /> : null}
        <Field label="Swap with">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className={inputClass}
          >
            <option value="">Choose a member…</option>
            {eligible.map((m) => (
              <option key={m.membershipId} value={m.membershipId}>
                {m.name} (position {m.position})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <textarea
            maxLength={300}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. I have an emergency and need to collect sooner — can we trade?"
            className={inputClass}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send request"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
