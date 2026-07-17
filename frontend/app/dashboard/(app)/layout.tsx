import DashboardShell from "@/components/dashboard/DashboardShell";

export default function CoordinatorAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
