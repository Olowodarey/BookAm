import { redirect } from "next/navigation";

/** Superseded by the unified sign-in page. */
export default function CoordinatorLoginRedirect() {
  redirect("/login");
}
