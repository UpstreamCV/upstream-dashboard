import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl px-8 py-14 text-center">
      <Icon className="w-7 h-7 mx-auto text-accent" />
      <h3 className="display text-xl font-semibold mt-3">{title}</h3>
      {description ? (
        <p className="text-sm text-ink-soft mt-3 max-w-prose mx-auto">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
