export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-accent mono">
          {eyebrow}
        </p>
        <h1 className="display text-3xl font-semibold mt-1.5">
          {title} <em>{accent}</em>
        </h1>
        {description ? (
          <p className="text-sm text-ink-soft mt-2 max-w-prose">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
