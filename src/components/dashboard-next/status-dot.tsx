export type DotStatus = "green" | "yellow" | "red" | "neutral";

// Figma status indicator (the small filled circle by each tile title).
// Yellow #EEDC68 is taken from the Figma asset; green/red align to the app's
// existing accent / danger base. `neutral` is a muted sage for idle/disabled
// states (reads clearly on the white cards). Hex kept so the `${color}22`
// halo trick below stays valid.
const COLOR: Record<DotStatus, string> = {
  green: "#5fb869",
  yellow: "#eedc68",
  red: "#e15a4c",
  neutral: "#9aa39a",
};

export function StatusDot({ status }: { status: DotStatus }) {
  const color = COLOR[status];
  return (
    <span
      aria-hidden
      className="inline-block rounded-full shrink-0"
      style={{
        width: "clamp(10px, 1vw, 15px)",
        height: "clamp(10px, 1vw, 15px)",
        background: color,
        boxShadow: `0 0 0 4px ${color}22`,
      }}
    />
  );
}
