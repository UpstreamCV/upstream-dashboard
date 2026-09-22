import { z } from "zod";
import { DEMO_MODE } from "@/lib/demo/demo-mode";

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_UPSTREAM_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const rawEnv = {
  NEXT_PUBLIC_UPSTREAM_API_URL: process.env.NEXT_PUBLIC_UPSTREAM_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

// In a build-time demo build the dashboard never calls Supabase or the
// api-server, so fill any unset vars with harmless placeholders instead of
// failing the boot — the demo then runs with only NEXT_PUBLIC_DEMO_MODE=1 set.
// (Runtime demo mode via the /demo cookie runs inside the normal build, which
// has the real values.) See src/lib/demo.
const parsed = ClientEnvSchema.safeParse(
  DEMO_MODE
    ? {
        NEXT_PUBLIC_UPSTREAM_API_URL:
          rawEnv.NEXT_PUBLIC_UPSTREAM_API_URL ?? "https://demo.invalid",
        NEXT_PUBLIC_SUPABASE_URL:
          rawEnv.NEXT_PUBLIC_SUPABASE_URL ?? "https://demo.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY:
          rawEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-not-used",
      }
    : rawEnv,
);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // The three vars we validate are all NEXT_PUBLIC_*, which Next inlines into
  // the client bundle at build time. They must be present during `next build`
  // on the host, not only at runtime.
  throw new Error(
    [
      "Missing or invalid environment variables.",
      "  Local dev:  copy .env.example to .env.local and fill in the values.",
      "  Netlify:    Site → Settings → Environment variables. Set each var",
      "              with the **Builds** scope enabled (Functions/Runtime",
      "              alone is not enough — NEXT_PUBLIC_* must be present at",
      "              `next build` time). Trigger a fresh deploy after edits.",
      "  Vercel:     Settings → Environment Variables, scope to Production",
      "              (and Preview if you use it), then redeploy.",
      "",
      issues,
    ].join("\n"),
  );
}

export const env = parsed.data;
