import { categoryColor, categoryLabel, findCategory, useCategories } from "@/lib/categories";
import { iconFor } from "@/lib/category-icons";
import type { CategoryId } from "@/lib/ordo";
import { cn } from "@/lib/utils";

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("panel ordo-grain p-4 sm:p-5", className)}>{children}</section>;
}

/**
 * Heading for a panel. The action sits beside the title on a tablet and above
 * it on a phone, because a title plus a three-button control group cannot share
 * a 320px line without one of them being clipped.
 */
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
<div
      className={cn(
        "mb-4 gap-2",
        action
          ? "flex flex-col-reverse items-stretch sm:flex-row sm:items-end sm:justify-between sm:gap-3"
          : "flex items-end justify-between gap-3",
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
        {hint ? <p className="mt-1 px-2 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 justify-end sm:block max-w-full overflow-hidden">{action}</div> : null}
    </div>
  );
}

export function CategoryDot({ id }: { id: CategoryId }) {
  const { categories } = useCategories();
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: categoryColor(categories, id) }}
      aria-hidden
    />
  );
}

/**
 * The category's lucide glyph, tinted to its colour. Falls back to a dot for an
 * id the registry has never heard of, so a deleted category still renders.
 */
export function CategoryIcon({
  id,
  className,
  colored = true,
}: {
  id: CategoryId;
  className?: string;
  colored?: boolean;
}) {
  const { categories } = useCategories();
  const Icon = iconFor(findCategory(categories, id)?.icon ?? "Circle");
  return (
    <Icon
      className={cn("size-4 shrink-0", className)}
      style={colored ? { color: categoryColor(categories, id) } : undefined}
      aria-hidden
    />
  );
}

export function CategoryPill({ id, icon = false }: { id: CategoryId; icon?: boolean }) {
  const { categories } = useCategories();
  const color = categoryColor(categories, id);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
        color,
      }}
    >
      {icon ? <CategoryIcon id={id} className="size-3" colored={false} /> : <CategoryDot id={id} />}
      {categoryLabel(categories, id)}
    </span>
  );
}

/**
 * Progress ring. Drawn in a 100×100 user space and scaled by CSS so the caller
 * can size it per breakpoint with a utility class instead of a pixel prop.
 */
export function Ring({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  const r = 45;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("relative shrink-0 size-20 sm:size-24", className)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg font-bold sm:text-xl">{value}%</span>
        {label ? (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="truncate font-display text-xl font-bold sm:text-2xl">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</div>
    </div>
  );
}

/**
 * A row of pills that would overflow a phone. Scrolls horizontally with snap
 * points below `sm` and wraps normally above it, so nothing is ever clipped
 * without a way to reach it.
 */
export function ScrollRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("scroll-row gap-1 pb-1 max-w-full overflow-x-auto sm:flex-nowrap sm:overflow-x-auto", className)}>
      {children}
    </div>
  );
}

/**
 * Option button used by the day pickers and step selectors. `size="lg"` meets
 * the 44px touch target on coarse pointers; the default stays compact.
 */
export function SegButton({
  active,
  onClick,
  className,
  children,
  ...rest
}: {
  active?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "scroll-row-item tap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1.5",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
