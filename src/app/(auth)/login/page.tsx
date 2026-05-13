import Link from "next/link";
import { safeNextPath } from "@/lib/safe-next";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  const signupHref =
    safeNext === "/dashboard"
      ? "/signup"
      : `/signup?next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="glass rounded-3xl p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-accent mono">
          upstream
        </p>
        <h1 className="display text-3xl font-semibold mt-2">
          Sign <em>in</em>
        </h1>
        <p className="text-sm text-ink-soft mt-2">
          Access the operator dashboard with your Upstream account.
        </p>
      </div>
      <LoginForm next={safeNext} />
      <p className="text-sm text-ink-soft mt-6 text-center">
        Don&rsquo;t have an account?{" "}
        <Link href={signupHref} className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
