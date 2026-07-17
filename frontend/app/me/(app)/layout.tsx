import MemberShell from "@/components/member/MemberShell";

export default function MemberAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MemberShell>{children}</MemberShell>;
}
