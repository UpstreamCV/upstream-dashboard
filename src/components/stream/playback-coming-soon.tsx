import { Radio } from "lucide-react";

export function PlaybackComingSoon() {
  return (
    <div className="glass rounded-3xl px-6 py-10 text-center">
      <Radio className="w-7 h-7 mx-auto text-accent" />
      <h3 className="display text-lg font-semibold mt-3">
        Live playback <em>coming soon</em>
      </h3>
      <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
        Browser playback over WebRTC is on the streaming-server roadmap. Until
        then, the latest captured frame appears alongside this card and
        refreshes every few seconds while the camera is online.
      </p>
    </div>
  );
}
