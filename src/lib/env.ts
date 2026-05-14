import { z } from "zod";

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_UPSTREAM_API_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = ClientEnvSchema.safeParse({
  NEXT_PUBLIC_UPSTREAM_API_URL: process.env.NEXT_PUBLIC_UPSTREAM_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

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
