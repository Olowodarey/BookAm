"use client";

import { useState } from "react";
import { useMemberCircle } from "../layout";
import type { MemberRow } from "@/lib/member/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { ContributionBadge, ReceiptModal } from "@/components/dashboard/ui";

/**
 * Read-only member list: everyone sees the same record. Receipts are
 * viewable by all circle members for transparency, but there are no
 * verify/reject controls here — that stays with the coordinator.
 */
export default function MemberCircleMembersPage() {
  const { detail } = useMemberCircle();
  const [viewing, setViewing] = useState<MemberRow | null>(null);

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${detail.circleName} · ${detail.members.length} members, in payout order. Everyone sees this same list.`}
      />

      <Card>
        {detail.members.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <ol className="divide-y divide-line/70">
            {detail.members.map((member) => (
              <li
                key={member.membershipId}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  member.isMe ? "bg-gold/10" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green/10 font-mono text-sm font-bold text-green">
                  {member.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {member.name}
                    {member.isMe ? (
                      <span className="ml-1.5 text-sm text-muted">(you)</span>
                    ) : null}
                    {member.hasCollected ? (
                      <span className="ml-2 align-middle">
                        <Badge tone="gold">Collected</Badge>
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {member.status ? (
                    <ContributionBadge status={member.status} />
                  ) : null}
                  {member.receiptFileUrl ? (
                    <button
                      onClick={() => setViewing(member)}
                      aria-label={`View receipt from ${member.name}`}
                      className="rounded-lg border border-line px-2.5 py-1.5 font-mono text-xs font-bold text-green hover:border-green"
                    >
                      Receipt 📎
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {viewing?.receiptFileUrl ? (
        <ReceiptModal
          path={viewing.receiptFileUrl}
          title={`Receipt — ${viewing.name}${viewing.status ? ` (${viewing.status.toLowerCase().replace("_", " ")})` : ""}`}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
