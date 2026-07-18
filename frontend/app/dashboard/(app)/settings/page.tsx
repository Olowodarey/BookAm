"use client";

import { useEffect, useState } from "react";
import { coordinatorApi } from "@/lib/dashboard/api";
import type { SafeUser } from "@/lib/dashboard/types";
import ProfileSettings from "@/components/settings/ProfileSettings";
import { Spinner } from "@/components/admin/ui";

export default function CoordinatorSettingsPage() {
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    coordinatorApi.me().then((me) => {
      if (!cancelled) setUser(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return <Spinner label="Loading settings…" />;
  return <ProfileSettings user={user} api={coordinatorApi} onSaved={setUser} />;
}
