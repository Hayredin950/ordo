import { CATEGORIES, catColor, type CategoryId } from "@/lib/ordo";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("panel ordo-grain p-5", className)}>{children}</section>;
}

export function PanelTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CategoryDot({ id }: { id: CategoryId }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: catColor(id) }}
      aria-hidden
    />
  );
}

export function CategoryPill({ id }: { id: CategoryId }) {
  const label = CATEGORIES.find((c) => c.id === id)?.label ?? id;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `color-mix(in oklab, ${catColor(id)} 18%, transparent)`, color: catColor(id) }}
    >
      <CategoryDot id={id} />
      {label}
    </span>
  );
}

export function Ring({
  value,
  size = 92,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, Math.max(0, value))) / 100}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold">{value}%</span>
        {label ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel px-4 py-3">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
