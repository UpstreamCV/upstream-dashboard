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
  throw new Error(
    `Missing or invalid environment variables. Copy .env.example to .env.local and fill in the values.\n${issues}`,
  );
}

export const env = parsed.data;
