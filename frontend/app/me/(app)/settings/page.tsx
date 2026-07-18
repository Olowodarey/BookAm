"use client";

import { useEffect, useState } from "react";
import { memberApi } from "@/lib/member/api";
import type { SafeUser } from "@/lib/member/types";
import ProfileSettings from "@/components/settings/ProfileSettings";
import { Spinner } from "@/components/admin/ui";

export default function MemberSettingsPage() {
  const [user, setUser] = useState<SafeUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    memberApi.me().then((me) => {
      if (!cancelled) setUser(me);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return <Spinner label="Loading settings…" />;
  return <ProfileSettings user={user} api={memberApi} onSaved={setUser} />;
}
