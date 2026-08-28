import { useMemo, useState } from "react";
import { ICON_GROUPS, ICON_NAMES, iconFor } from "@/lib/category-icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

/**
 * Grid of every icon a category may use, filtered by a free-text search over the
 * lucide component names. Roughly 150 buttons is too many for a phone screen, so
 * the grid scrolls inside a fixed height rather than pushing the form off-screen.
 */
export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (name: string) => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_GROUPS.map((g) => ({ label: g.label, names: Object.keys(g.icons) }));
    const hits = ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
    return hits.length ? [{ label: `${hits.length} matches`, names: hits }] : [];
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons — heart, book, moon…"
          aria-label="Search icons"
          className="pl-8"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-border p-2">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No icon matches “{query.trim()}”.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2 last:mb-0">
              <p className="mb-1 px-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {g.label}
              </p>
              <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
                {g.names.map((name) => {
                  const Icon = iconFor(name);
                  const active = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      aria-pressed={active}
                      onClick={() => onChange(name)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border transition-colors",
                        active
                          ? "border-primary bg-primary/15"
                          : "border-transparent bg-muted/60 hover:bg-accent",
                      )}
                    >
                      <Icon className="size-4" style={active ? { color } : undefined} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
