import { CodeBlock } from "@/components/dashboard-next/code-block";

// API Docs — static reference, authored from
// ../upstream-api-server/docs/api-contracts.md. No backend: hand-maintained
// documentation of authentication, the public endpoint families, and copy-paste
// code examples. Keep in sync with the contracts doc.

export const metadata = { title: "API Docs · Upstream" };

const ENDPOINT_GROUPS: { group: string; lines: string[] }[] = [
  {
    group: "Cameras",
    lines: [
      "GET    /v1/cameras",
      "POST   /v1/cameras",
      "GET    /v1/cameras/{id}",
      "PATCH  /v1/cameras/{id}",
      "GET    /v1/cameras/{id}/observations/recent",
      "GET    /v1/cameras/{id}/reliability/summary",
    ],
  },
  {
    group: "Agents & sessions",
    lines: [
      "GET    /v1/agents",
      "GET    /v1/agents/{id}",
      "GET    /v1/agents/{id}/heartbeats",
      "POST   /v1/stream-sessions/start",
      "GET    /v1/stream-sessions/{id}",
      "POST   /v1/stream-sessions/{id}/stop",
    ],
  },
  {
    group: "Automation & output",
    lines: [
      "GET    /v1/rules        POST /v1/rules",
      "PATCH  /v1/rules/{id}   DELETE /v1/rules/{id}",
      "GET    /v1/workflows    POST /v1/workflows",
      "GET    /v1/workflow-runs",
      "GET    /v1/alerts",
      "POST   /v1/alerts/{id}/read    POST /v1/alerts/{id}/resolve",
    ],
  },
  {
    group: "Account",
    lines: [
      "GET    /v1/usage/summary",
      "GET    /v1/account/limits",
      "GET    /v1/dashboard/summary",
      "GET    /v1/api-tokens   POST /v1/api-tokens   DELETE /v1/api-tokens/{id}",
    ],
  },
];

const CURL_EXAMPLE = `curl https://api.upstreamcv.com/v1/cameras \\
  -H "Authorization: Bearer ups_live_<id>_<secret>" \\
  --get --data-urlencode "account_id=<account_id>"`;

const AGENT_EXAMPLE = `pip install upstream-agent
upstream-agent init --token ups_live_<id>_<secret>
upstream-agent start --camera-index 0 --width 1280 --height 720 --fps 30`;

const ERROR_ENVELOPE = `{
  "error": {
    "code": "forbidden_account",
    "message": "…human-readable, may change…",
    "details": {},
    "request_id": "req_…"
  }
}`;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
      <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          API Docs
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          Integrate with the Upstream control plane. Reference for
          authentication, the public endpoint families, and code examples.
        </p>
      </div>

      <Section title="Authentication">
        <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          All requests use a Bearer token. Create one under{" "}
          <span className="font-mono text-white">API Tokens</span>; it&apos;s
          shown once. Programmatic clients (agents, scripts) send:
        </p>
        <CodeBlock
          code={`Authorization: Bearer ups_<env>_<id>_<secret>`}
          copyable
        />
        <ul className="list-disc pl-5 space-y-1 text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          <li>
            Pass <span className="font-mono text-white">account_id</span> as a
            query param if your token belongs to more than one account.
          </li>
          <li>
            Errors use a stable envelope — switch on{" "}
            <span className="font-mono text-white">error.code</span>, not the
            message:
          </li>
        </ul>
        <CodeBlock code={ERROR_ENVELOPE} copyable />
      </Section>

      <Section title="Endpoints">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ENDPOINT_GROUPS.map((g) => (
            <div key={g.group}>
              <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
                {g.group}
              </p>
              <CodeBlock code={g.lines.join("\n")} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Code examples">
        <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          List cameras with curl:
        </p>
        <CodeBlock code={CURL_EXAMPLE} copyable />
        <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          Bring a camera online with the agent:
        </p>
        <CodeBlock code={AGENT_EXAMPLE} copyable />
      </Section>
    </div>
  );
}
