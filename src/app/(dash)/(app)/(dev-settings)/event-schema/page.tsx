import { CodeBlock } from "@/components/dashboard-next/code-block";

// Event Schema — static reference, authored from
// ../upstream-api-server/docs/api-contracts.md (observation records + the rule
// trigger table). No backend: this is documentation of the event vocabulary the
// processor emits and that rules/workflows trigger on. Keep in sync with the
// contracts doc when the event vocabulary changes.

export const metadata = { title: "Event Schema · Upstream" };

const EVENT_TYPES: {
  type: string;
  rule: string;
  fields: string;
  desc: string;
}[] = [
  {
    type: "processor.line_crossing",
    rule: "line_crossing",
    fields: "line_id",
    desc: "An object crossed a configured counting line.",
  },
  {
    type: "processor.zone_entered",
    rule: "zone_entered",
    fields: "zone_id",
    desc: "An object entered a configured ROI / zone.",
  },
  {
    type: "processor.dwell_exceeded",
    rule: "dwell_exceeded",
    fields: "zone_id, min_duration_seconds",
    desc: "An object stayed inside a zone past the dwell threshold.",
  },
];

const OBSERVATION_EXAMPLE = `{
  "id": "uuid",
  "camera_id": "uuid",
  "stream_session_id": "uuid",
  "processor_id": "proc-1",
  "package_id": "pkg.detect.v1",
  "type": "processor.dwell_exceeded",
  "payload": {
    "zone_id": "zone-entrance",
    "min_duration_seconds": 30,
    "class_label": "person",
    "track_id": "t-1042"
  },
  "observed_at": "2026-05-21T12:00:00Z",
  "created_at": "2026-05-21T12:00:01Z"
}`;

const WORKFLOW_TRIGGER_EXAMPLE = `{
  "trigger_type": "processor.line_crossing",
  "payload": {
    "rule": { "id": "uuid", "rule_type": "line_crossing" },
    "observation": { "line_id": "line-door", "class_label": "person" }
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

export default function EventSchemaPage() {
  return (
    <div className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]">
      <div>
        <h1 className="text-[clamp(1.3rem,2vw,1.8rem)] font-bold text-white">
          Event Schema
        </h1>
        <p className="mt-1 text-sm text-[var(--dn-text-50)]">
          The event vocabulary the processor emits and that Rules &amp;
          Workflows trigger on. The observation <code>type</code> is open
          vocabulary — unknown types read fine and never break a consumer.
        </p>
      </div>

      <Section title="Event types">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[clamp(0.78rem,1vw,0.92rem)]">
            <thead>
              <tr className="text-[var(--dn-text-50)] [&>th]:whitespace-nowrap [&>th]:py-2 [&>th]:pr-4 [&>th]:text-[0.72em] [&>th]:font-bold [&>th]:uppercase [&>th]:tracking-wide">
                <th>Event type</th>
                <th>Rule type</th>
                <th>Key fields</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {EVENT_TYPES.map((e) => (
                <tr
                  key={e.type}
                  className="border-t border-[var(--dn-text-15)] [&>td]:py-2.5 [&>td]:pr-4 [&>td]:align-top"
                >
                  <td className="font-mono text-white whitespace-nowrap">
                    {e.type}
                  </td>
                  <td className="font-mono text-[var(--dn-text-50)] whitespace-nowrap">
                    {e.rule}
                  </td>
                  <td className="font-mono text-[var(--dn-text-50)]">
                    {e.fields}
                  </td>
                  <td className="text-[var(--dn-text-50)]">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Payload examples">
        <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          Observation record (as returned by{" "}
          <code className="font-mono">
            GET /v1/cameras/{"{camera_id}"}/observations/recent
          </code>
          ):
        </p>
        <CodeBlock code={OBSERVATION_EXAMPLE} copyable />
        <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
          Workflow-run trigger payload:
        </p>
        <CodeBlock code={WORKFLOW_TRIGGER_EXAMPLE} copyable />
      </Section>
    </div>
  );
}
