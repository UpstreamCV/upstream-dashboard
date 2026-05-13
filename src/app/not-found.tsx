import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-dvh grid place-items-center px-6 py-16">
      <div className="glass rounded-3xl p-8 max-w-md text-center">
        <Compass className="w-7 h-7 mx-auto text-accent" />
        <h1 className="display text-3xl font-semibold mt-3">
          Not <em>here</em>
        </h1>
        <p className="text-sm text-ink-soft mt-3">
          We couldn&rsquo;t find the page you were looking for. It may have been
          renamed or is scoped to a different account.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex mt-5 rounded-full bg-ink text-base-2 font-medium px-4 py-2 text-sm transition hover:bg-white"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
