import { Radio } from "lucide-react";
import type { StreamSession } from "@/lib/api/types";
import { LiveStreamPlayer } from "./live-stream-player";

export function LiveStreamPanel({
  session,
}: {
  session: StreamSession | null;
}) {
  if (!session) {
    return (
      <div className="glass rounded-3xl px-6 py-10 text-center">
        <Radio className="w-7 h-7 mx-auto text-ink-mute" />
        <h3 className="display text-lg font-semibold mt-3">
          No <em>session</em> yet
        </h3>
        <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
          When the agent calls{" "}
          <span className="mono text-ink">POST /v1/stream-sessions/start</span>{" "}
          and begins publishing, live video appears here.
        </p>
      </div>
    );
  }

  if (session.state === "approved") {
    return (
      <div className="glass rounded-3xl px-6 py-10 text-center">
        <Radio className="w-7 h-7 mx-auto text-accent" />
        <h3 className="display text-lg font-semibold mt-3">
          Waiting for <em>stream</em>
        </h3>
        <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
          The session is approved but the agent hasn&rsquo;t started publishing
          yet. Live video appears here as soon as the SRT publish is accepted.
        </p>
      </div>
    );
  }

  if (session.state === "streaming") {
    // The api-server (not the dashboard) derives the MediaMTX path from the
    // session's streamid — see /v1/stream-sessions/{id}/whep. We pass the
    // session id through and let the proxy do the lookup + auth check.
    return (
      <LiveStreamPlayer sessionId={session.id} approved={session.approved} />
    );
  }

  // ended | expired | failed
  return (
    <div className="glass rounded-3xl px-6 py-10 text-center">
      <Radio className="w-7 h-7 mx-auto text-ink-mute" />
      <h3 className="display text-lg font-semibold mt-3">
        Stream <em>{session.state}</em>
      </h3>
      <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
        {session.state === "failed"
          ? "The last session failed validation. Check the validation panel for the mismatched fields."
          : "Live video will return when the agent starts a new session."}
      </p>
    </div>
  );
}
