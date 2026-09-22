// Slim, always-visible "Demo" indicator with the Exit control. Mounted by the
// (app) layout only when demo mode is on. Sits bottom-centre so it never
// collides with the rail (left), the top-right tools, or the recorder's
// DemoStepper (bottom-right, hidden until backtick). Server Component — no
// state; "Exit demo" is a plain link to /demo/exit, which clears the cookies
// and lands on /login.
export function DemoBadge() {
  return (
    <div
      data-demo-badge
      style={{
        position: "fixed",
        left: "50%",
        bottom: 10,
        transform: "translateX(-50%)",
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 6px 5px 12px",
        borderRadius: 999,
        background: "rgba(15,20,14,0.88)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
        color: "rgba(255,255,255,0.85)",
        font: "500 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.02em",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: "#ecc06a",
          boxShadow: "0 0 8px rgba(236,192,106,0.7)",
        }}
      />
      <span>Demo · sample data</span>
      <a
        href="/demo/exit"
        style={{
          borderRadius: 999,
          padding: "4px 10px",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Exit demo
      </a>
    </div>
  );
}
