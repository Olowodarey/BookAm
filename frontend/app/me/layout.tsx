import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "My circles",
    template: "%s · BookAm",
  },
  robots: { index: false, follow: false },
};

export default function MemberRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
