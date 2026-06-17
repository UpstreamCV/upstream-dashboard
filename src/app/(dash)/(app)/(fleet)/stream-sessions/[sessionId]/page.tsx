import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  SessionPanel,
  ValidationPanel,
} from "@/components/dashboard-next/camera-panels";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { listValidations } from "@/lib/api/validations";
import type {
  Agent,
  Camera,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";

// Session Detail — one stream session plus its stream-validation diagnostics.
//
// The single-session GET (GET /v1/stream-sessions/{id}) is documented
// current_agent / owner-only, so a dashboard (current_user) call may 403. We
// therefore resolve the session by list-and-find over the recent sessions
// rather than a direct getter — robust for recent sessions; a very old session
// id outside the recent window won't resolve (acceptable until an account-scoped
// single-session read exists). Validations come from the existing
// listValidations({ sessionId }); diagnostics reuse the Monitor tab's
// ValidationPanel.

const SESSION_LOOKUP_LIMIT = 100;

export default async function StreamSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const sessions = await listStreamSessions({
    accountId: activeAccountId,
    limit: SESSION_LOOKUP_LIMIT,
  });
  const session: StreamSession | undefined = sessions.find(
    (s) => s.id === sessionId,
  );
  if (!session) {
    notFound();
  }

  const [camera, agent, validations]: [
    Camera | null,
    Agent | null,
    StreamValidation[],
  ] = await Promise.all([
    getCamera({ accountId: activeAccountId, cameraId: session.camera_id }).catch(
      (err) => {
        if (err instanceof UpstreamApiError) return null;
        throw err;
      },
    ),
    getAgent({ accountId: activeAccountId, agentId: session.agent_id }).catch(
      (err) => {
        if (err instanceof UpstreamApiError) return null;
        throw err;
      },
    ),
    listValidations({ accountId: activeAccountId, sessionId }).catch((err) => {
      if (err instanceof UpstreamApiError && err.status === 404) return [];
      throw err;
    }),
  ]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/stream-sessions"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Stream Sessions
        </Link>
      </div>

      <header className="min-w-0">
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-white/65">
          stream session
        </p>
        <h1 className="mt-1.5 font-mono font-bold text-white text-[clamp(1.2rem,2.4vw,1.8rem)] break-all">
          {session.id}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75">
          <span>
            Camera:{" "}
            <Link
              href={`/cameras/${session.camera_id}`}
              className="font-bold text-white hover:underline underline-offset-2"
            >
              {camera?.name ?? session.camera_id.slice(0, 8) + "…"}
            </Link>
          </span>
          <span>
            Agent:{" "}
            <Link
              href={`/agents/${session.agent_id}`}
              className="font-bold text-white hover:underline underline-offset-2"
            >
              {agent?.name ?? session.agent_id.slice(0, 8) + "…"}
            </Link>
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <SessionPanel session={session} />
        <ValidationPanel validation={validations[0] ?? null} />
      </div>

      <section className="space-y-3 md:space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
            Stream diagnostics
          </h2>
          <span className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            {validations.length} validation{validations.length === 1 ? "" : "s"}
          </span>
        </div>
        {validations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {validations.map((v) => (
              <ValidationPanel key={v.id} validation={v} />
            ))}
          </div>
        ) : (
          <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <p className="text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)]">
              No stream validations recorded for this session.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
