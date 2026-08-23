import Link from "next/link";

/**
 * The landing page's primary calls to action now that BookAm is open to
 * everyone: create an account or sign in. (Replaced the pre-launch waitlist
 * form.) Pass `className` to control alignment in each section.
 */
export default function GetStartedCtas({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <Link
        href="/register"
        className="inline-flex items-center justify-center rounded-xl bg-green px-6 py-3 font-semibold text-paper transition-colors hover:bg-green-deep"
      >
        Create your free account
      </Link>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-xl border-2 border-green/30 bg-white px-6 py-3 font-semibold text-green transition-colors hover:border-green"
      >
        Sign in
      </Link>
    </div>
  );
}
