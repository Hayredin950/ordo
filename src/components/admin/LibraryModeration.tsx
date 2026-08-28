import { useCallback, useEffect, useState } from "react";
import * as db from "@/lib/db";
import type { PublicTemplate } from "@/lib/db";
import { formatTimeRange, type HourFormat } from "@/lib/ordo";
import { CategoryDot, Panel, PanelTitle } from "@/components/ordo/primitives";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * The shared template library, with the delete power the admin policy grants on
 * `public_templates`. Expanding a template shows the blocks it would apply, so a
 * takedown decision does not have to be made from the title alone.
 */
export function LibraryModeration({ hourFormat = "24h" }: { hourFormat?: HourFormat }) {
  const [rows, setRows] = useState<PublicTemplate[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await db.listPublicTemplates());
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: PublicTemplate) => {
    setBusy(true);
    try {
      await db.adminDeleteTemplate(row.id);
      setRows((rs) => (rs ? rs.filter((r) => r.id !== row.id) : rs));
      toast.success(`Removed “${row.name}” from the library`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that template");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelTitle
        title="Template library"
        hint="Everything users have published. Yours is the only account that can take one down."
      />
      <div className="space-y-2">
        {!rows ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading library…
          </p>
        ) : null}
        {rows?.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nobody has published a template yet.
          </p>
        ) : null}
        {rows?.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  by {t.author_name || "Anonymous"} · {t.blocks.length} blocks · {t.copies} cop
                  {t.copies === 1 ? "y" : "ies"} · {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="tap shrink-0"
                aria-expanded={open === t.id}
                onClick={() => setOpen(open === t.id ? null : t.id)}
              >
                {open === t.id ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
                Blocks
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="tap shrink-0"
                    disabled={busy}
                    aria-label={`Remove ${t.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove “{t.name}” from the library?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It disappears for everyone browsing the library. Copies already applied to
                      someone's own routine are untouched.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="tap">Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      className="tap bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void remove(t)}
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {open === t.id ? (
              <ul className="mt-2 space-y-1 border-t border-border pt-2">
                {t.blocks.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-xs">
                    <CategoryDot id={b.category} />
                    <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                      {formatTimeRange(b.start, b.end, hourFormat)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
