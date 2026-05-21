import { Radio } from "lucide-react";
import type { StreamSession } from "@/lib/api/types";
import { LiveStreamPlayerNext } from "./live-stream-player-next";

// Light-theme port of src/components/stream/live-stream-panel.tsx. Picks the
// right rendering for the session's current state: missing, waiting, live,
// or terminal. Server Component — only the player itself is client-side.

export function LiveStreamPanelNext({
  session,
}: {
  session: StreamSession | null;
}) {
  if (!session) {
    return (
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
        <Radio
          className="w-7 h-7 mx-auto text-[var(--dn-text-50)]"
          aria-hidden
        />
        <h3 className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] mt-3">
          No session yet
        </h3>
        <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
          When the agent calls{" "}
          <span className="font-mono text-black/80">
            POST /v1/stream-sessions/start
          </span>{" "}
          and begins publishing, live video appears here.
        </p>
      </div>
    );
  }

  if (session.state === "approved") {
    return (
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
        <Radio className="w-7 h-7 mx-auto text-[#5fb869]" aria-hidden />
        <h3 className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] mt-3">
          Waiting for stream
        </h3>
        <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
          The session is approved but the agent hasn&rsquo;t started publishing
          yet. Live video appears here as soon as the SRT publish is accepted.
        </p>
      </div>
    );
  }

  if (session.state === "streaming") {
    return (
      <LiveStreamPlayerNext
        sessionId={session.id}
        cameraId={session.camera_id}
        approved={session.approved}
      />
    );
  }

  // ended | expired | failed
  return (
    <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
      <Radio className="w-7 h-7 mx-auto text-[var(--dn-text-50)]" aria-hidden />
      <h3 className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] mt-3 capitalize">
        Stream {session.state}
      </h3>
      <p className="text-sm text-[var(--dn-text-50)] mt-2 max-w-md mx-auto">
        {session.state === "failed"
          ? "The last session failed validation. Check the validation panel for the mismatched fields."
          : "Live video will return when the agent starts a new session."}
      </p>
    </div>
  );
}
