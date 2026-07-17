"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, formatDate } from "@/lib/admin/api";
import { useAdminUser } from "@/components/admin/AdminShell";
import type {
  Paginated,
  Role,
  SafeUser,
  UserStatus,
} from "@/lib/admin/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/admin/ui";

export default function UsersPage() {
  const admin = useAdminUser();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SafeUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SafeUser | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        await adminApi.listUsers({
          search: search || undefined,
          role: role || undefined,
          status: status || undefined,
          page,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  }, [search, role, status, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Everybody on the platform — members, coordinators and admins."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or phone…"
          aria-label="Search users by name or phone"
          className={`${inputClass} max-w-xs`}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          aria-label="Filter by role"
          className={`${inputClass} w-auto`}
        >
          <option value="">All roles</option>
          <option value="MEMBER">Member</option>
          <option value="COORDINATOR">Coordinator</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as UserStatus | "");
            setPage(1);
          }}
          aria-label="Filter by account status"
          className={`${inputClass} w-auto`}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <Card className="overflow-x-auto">
        {!data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="No users found"
            hint="Try a different search or filter."
          />
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wide text-ink/60">
                <th scope="col" className="px-5 py-3 font-bold">Name</th>
                <th scope="col" className="px-5 py-3 font-bold">Phone</th>
                <th scope="col" className="px-5 py-3 font-bold">Role</th>
                <th scope="col" className="px-5 py-3 font-bold">Status</th>
                <th scope="col" className="px-5 py-3 font-bold">Joined</th>
                <th scope="col" className="px-5 py-3 font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-line/60 last:border-0 hover:bg-white/60"
                >
                  <td className="px-5 py-3.5 font-semibold">{user.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">
                    {user.phone}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={user.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-5 py-3.5 text-muted">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {user.role !== "ADMIN" && user.id !== admin.id ? (
                      <Button
                        variant={
                          user.status === "ACTIVE" ? "danger" : "secondary"
                        }
                        onClick={() => setConfirming(user)}
                      >
                        {user.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {data && data.total > data.pageSize ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="font-mono text-xs text-muted">
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

      {confirming ? (
        <ConfirmStatusModal
          user={confirming}
          onClose={() => setConfirming(null)}
          onDone={() => {
            setConfirming(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ConfirmStatusModal({
  user,
  onClose,
  onDone,
}: {
  user: SafeUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const suspending = user.status === "ACTIVE";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (suspending) {
        await adminApi.suspendUser(user.id);
      } else {
        await adminApi.reactivateUser(user.id);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={suspending ? "Suspend account" : "Reactivate account"}
      onClose={onClose}
    >
      <p className="text-sm text-ink/80">
        {suspending ? (
          <>
            <span className="font-semibold">{user.name}</span> (
            <span className="font-mono text-xs">{user.phone}</span>) will not
            be able to sign in until reactivated. Their records stay intact.
          </>
        ) : (
          <>
            <span className="font-semibold">{user.name}</span> (
            <span className="font-mono text-xs">{user.phone}</span>) will be
            able to sign in again.
          </>
        )}
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
        <Button
          variant={suspending ? "danger" : "primary"}
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting
            ? "Working…"
            : suspending
              ? "Suspend account"
              : "Reactivate account"}
        </Button>
      </div>
    </Modal>
  );
}
