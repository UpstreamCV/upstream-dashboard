import Link from "next/link";
import { safeNextPath } from "@/lib/safe-next";
import { SignUpForm } from "./signup-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  const loginHref = safeNext === "/" ? "/login" : `/login?next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="glass rounded-3xl p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-accent mono">
          upstream
        </p>
        <h1 className="display text-3xl font-semibold mt-2">
          Create your <em>account</em>
        </h1>
        <p className="text-sm text-ink-soft mt-2">
          One account is one workspace. You can invite teammates later.
        </p>
      </div>
      <SignUpForm next={safeNext} />
      <p className="text-sm text-ink-soft mt-6 text-center">
        Already have an account?{" "}
        <Link href={loginHref} className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
