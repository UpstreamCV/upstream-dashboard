import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";

// Setup instructions for the Upstream Collector, rendered directly on
// /agents/collector. The collector authenticates to the cloud with the agent's
// stored API token; the LOCAL endpoint takes no token, so none of these
// snippets contain a credential. Static content — safe in a server component.

const CURL_EXAMPLE = `curl -X POST http://127.0.0.1:8756/v1/observations \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_batch_id": "manual-batch-1",
    "source": "manual-local-test",
    "observations": [
      {
        "type": "event_observed",
        "external_camera_key": "dock-12",
        "observed_at": "2026-06-22T18:05:12Z",
        "payload": {
          "event_name": "line_crossing",
          "class_label": "person",
          "confidence": 0.87,
          "track_id": "t1"
        }
      }
    ]
  }'`;

const PYTHON_EXAMPLE = `import requests
from datetime import datetime, timezone

requests.post(
    "http://127.0.0.1:8756/v1/observations",
    json={
        "client_batch_id": "batch-123",
        "source": "edge-box-1",
        "observations": [
            {
                "type": "event_observed",
                "external_camera_key": "dock-12",
                "observed_at": datetime.now(timezone.utc).isoformat(),
                "payload": {
                    "event_name": "line_crossing",
                    "class_label": "person",
                    "confidence": 0.87,
                    "track_id": "t1"
                }
            }
        ]
    },
    timeout=0.5,
)`;

const DETECTION_SUMMARY_EXAMPLE = `{
  "type": "detection_summary",
  "external_camera_key": "dock-12",
  "observed_at": "2026-06-22T18:05:20Z",
  "payload": {
    "window_seconds": 10,
    "counts_by_class": { "person": 42, "forklift": 7 },
    "avg_confidence_by_class": { "person": 0.82, "forklift": 0.76 },
    "model_name": "detector-v1",
    "model_version": "2026-06-22"
  }
}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dn-tile space-y-3 p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CollectorSetupCard() {
  return (
    <div className="space-y-4 md:space-y-6">
      <Section title="Set up the collector">
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-white/80">
          <li>
            Run <span className="font-mono text-white">upstream</span> on the
            host next to your CV system.
          </li>
          <li>Log in if prompted (your API token is stored locally).</li>
          <li>
            Start the collector:{" "}
            <span className="font-mono text-white">collector start</span>
          </li>
          <li>
            Send observations to{" "}
            <span className="font-mono text-white">
              POST http://127.0.0.1:8756/v1/observations
            </span>{" "}
            — the collector buffers, retries, and uploads them to Upstream.
          </li>
        </ol>
        <p className="text-sm text-[var(--dn-text-50)]">
          Your CV system sends to localhost; it never calls Upstream Cloud
          directly.
        </p>
      </Section>

      <Section title="curl">
        <CodeBlock code={CURL_EXAMPLE} copyable />
      </Section>

      <Section title="Python">
        <CodeBlock code={PYTHON_EXAMPLE} copyable />
      </Section>

      <Section title="Detection summary payload">
        <CodeBlock code={DETECTION_SUMMARY_EXAMPLE} copyable />
      </Section>
    </div>
  );
}
