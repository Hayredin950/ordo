import { useState } from "react";
import { slugify, useCategories, type Category } from "@/lib/categories";
import { iconFor } from "@/lib/category-icons";
import * as db from "@/lib/db";
import { Panel, PanelTitle } from "@/components/ordo/primitives";
import { IconPicker } from "./IconPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Check, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Colours offered to the admin. The first six are the built-in category hues
 * (kept as custom properties so they follow the theme); the rest are fixed oklch
 * values, because a new category has no variable to point at.
 */
const PALETTE = [
  "var(--cat-health)",
  "var(--cat-study)",
  "var(--cat-work)",
  "var(--cat-finance)",
  "var(--cat-spiritual)",
  "var(--cat-relationships)",
  "oklch(0.74 0.15 20)",
  "oklch(0.76 0.15 45)",
  "oklch(0.80 0.14 85)",
  "oklch(0.78 0.16 130)",
  "oklch(0.74 0.13 175)",
  "oklch(0.72 0.14 215)",
  "oklch(0.70 0.15 285)",
  "oklch(0.74 0.15 330)",
  "oklch(0.62 0.02 265)",
];

type Draft = {
  /** Empty while creating — the slug is derived from the label until touched. */
  id: string;
  label: string;
  color: string;
  icon: string;
  sort: number;
  isNew: boolean;
  /** True when editing a code-defined category: the id may not change. */
  builtin: boolean;
};

/**
 * The admin's category editor. Writes go to `app_categories`, which only an
 * admin may modify — the policy, not this component, is the actual guard.
 * Deleting a row that overrode a built-in restores the code default; deleting a
 * custom one leaves any block still pointing at it rendering under its raw id.
 */
export function CategoryManager() {
  const { categories, refresh } = useCategories();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const nextSort = Math.max(0, ...categories.map((c) => c.sort)) + 10;

  const startNew = () =>
    setDraft({
      id: "",
      label: "",
      color: PALETTE[6]!,
      icon: "Target",
      sort: nextSort,
      isNew: true,
      builtin: false,
    });

  const startEdit = (c: Category) =>
    setDraft({
      id: c.id,
      label: c.label,
      color: c.color,
      icon: c.icon,
      sort: c.sort,
      isNew: false,
      builtin: c.builtin,
    });

  const save = async () => {
    if (!draft) return;
    const label = draft.label.trim();
    if (!label) {
      toast.error("Give the category a name");
      return;
    }
    const id = draft.isNew ? draft.id.trim() || slugify(label) : draft.id;
    if (draft.isNew && categories.some((c) => c.id === id)) {
      toast.error(`“${id}” already exists — pick another name`);
      return;
    }
    setBusy(true);
    try {
      await db.upsertCategory({
        id,
        label,
        color: draft.color,
        icon: draft.icon,
        sort: draft.sort,
      });
      await refresh();
      toast.success(draft.isNew ? `Added “${label}”` : `Saved “${label}”`);
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the category");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    setBusy(true);
    try {
      await db.deleteCategory(c.id);
      await refresh();
      toast.success(c.builtin ? `“${c.label}” reset to its default` : `Deleted “${c.label}”`);
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the category");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelTitle
        title="Categories"
        hint="Six ship in the app. Anything you add here shows up for every user."
        action={
          <Button size="sm" className="tap w-full sm:w-auto" onClick={startNew} disabled={busy}>
            <Plus className="size-4" /> Category
          </Button>
        }
      />

      {draft ? (
        <CategoryForm
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => void save()}
        />
      ) : null}

      <ul className="mt-3 space-y-2">
        {categories.map((c) => {
          const Icon = iconFor(c.icon);
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `color-mix(in oklab, ${c.color} 20%, transparent)` }}
              >
                <Icon className="size-4" style={{ color: c.color }} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-sm font-medium">{c.label}</span>
                  <Badge>{c.builtin ? (c.stored ? "overridden" : "built-in") : "custom"}</Badge>
                </div>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {c.id} · sort {c.sort}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="tap shrink-0"
                aria-label={`Edit ${c.label}`}
                onClick={() => startEdit(c)}
              >
                <Pencil className="size-4" />
              </Button>
              {c.builtin && !c.stored ? null : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="tap shrink-0"
                      aria-label={c.builtin ? `Reset ${c.label}` : `Delete ${c.label}`}
                    >
                      {c.builtin ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {c.builtin ? `Reset “${c.label}” to default?` : `Delete “${c.label}”?`}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {c.builtin
                          ? "The stored override is removed and the built-in colour, icon and name come back."
                          : "Blocks and goals already filed under this category keep the id and show up unlabelled until they are moved."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="tap">Keep it</AlertDialogCancel>
                      <AlertDialogAction
                        className={cn(
                          "tap",
                          !c.builtin &&
                            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                        )}
                        onClick={() => void remove(c)}
                      >
                        {c.builtin ? "Reset" : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function CategoryForm({
  draft,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  busy: boolean;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const Preview = iconFor(draft.icon);
  // While creating, the id follows the name until the admin edits it by hand.
  const id = draft.isNew ? draft.id.trim() || slugify(draft.label || "new-category") : draft.id;

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${draft.color} 20%, transparent)` }}
        >
          <Preview className="size-5" style={{ color: draft.color }} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold">
            {draft.isNew ? "New category" : `Editing ${draft.label || draft.id}`}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {id} · {draft.icon}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <Input
          value={draft.label}
          placeholder="e.g. Volunteering"
          aria-label="Category name"
          maxLength={40}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
        />
        <Input
          type="number"
          min={0}
          max={9999}
          value={draft.sort}
          aria-label="Sort order"
          onChange={(e) => onChange({ ...draft, sort: Number(e.target.value) || 0 })}
        />
      </div>

      {draft.isNew ? (
        <Input
          value={draft.id}
          placeholder={slugify(draft.label || "new-category")}
          aria-label="Category id"
          className="font-mono text-xs"
          onChange={(e) => onChange({ ...draft, id: slugify(e.target.value) })}
        />
      ) : null}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Colour
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={draft.color === c}
              onClick={() => onChange({ ...draft, color: c })}
              className={cn(
                "size-7 rounded-full border-2 transition-transform",
                draft.color === c ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Icon
        </p>
        <IconPicker
          value={draft.icon}
          color={draft.color}
          onChange={(icon) => onChange({ ...draft, icon })}
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="tap flex-1 sm:flex-none" disabled={busy} onClick={onSave}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {draft.isNew ? "Create" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="tap flex-1 sm:flex-none"
          disabled={busy}
          onClick={onCancel}
        >
          <X className="size-4" /> Cancel
        </Button>
      </div>
    </div>
  );
}
