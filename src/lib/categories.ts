/**
 * The category registry. Six categories ship in the code so a signed-out browser
 * still renders a coloured plan; an admin can override any of them or add new
 * ones through `public.app_categories`, and a stored row with the same id wins.
 *
 * Colours are plain CSS colours (the built-ins point at the `--cat-*` custom
 * properties in styles.css) and icons are lucide component names resolved
 * against the fixed registry in `category-icons.ts`, so an unknown name degrades
 * to a dot instead of crashing a render.
 */
import { createContext, useContext } from "react";

/** A category id is just a slug now: the admin can mint new ones at runtime. */
export type CategoryId = string;

export type Category = {
  id: CategoryId;
  label: string;
  color: string;
  /** lucide component name, e.g. `"HeartPulse"`. */
  icon: string;
  sort: number;
  /** Defined in code, so it exists even with no database. */
  builtin: boolean;
  /** Has a row in `app_categories` — an admin created or overrode it. */
  stored: boolean;
};

/** The `app_categories` row shape, as the client reads and writes it. */
export type CategoryRow = {
  id: string;
  label: string;
  color: string;
  icon: string;
  sort: number;
};

export const BUILTIN_CATEGORIES: Category[] = [
  { id: "health", label: "Health", color: "var(--cat-health)", icon: "HeartPulse", sort: 10 },
  { id: "study", label: "Study", color: "var(--cat-study)", icon: "BookOpen", sort: 20 },
  { id: "work", label: "Work", color: "var(--cat-work)", icon: "Briefcase", sort: 30 },
  { id: "finance", label: "Finance", color: "var(--cat-finance)", icon: "Wallet", sort: 40 },
  { id: "spiritual", label: "Spiritual", color: "var(--cat-spiritual)", icon: "Moon", sort: 50 },
  {
    id: "relationships",
    label: "Relationships",
    color: "var(--cat-relationships)",
    icon: "Users",
    sort: 60,
  },
].map((c) => ({ ...c, builtin: true, stored: false }));

/** Colour used for an id nothing knows about — a category deleted under a plan. */
export const UNKNOWN_CATEGORY_COLOR = "var(--muted-foreground)";

/** Stored rows layered over the built-ins, ordered the way every list shows them. */
export function mergeCategories(rows: CategoryRow[]): Category[] {
  const byId = new Map<string, Category>(BUILTIN_CATEGORIES.map((c) => [c.id, c]));
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      label: row.label,
      color: row.color,
      icon: row.icon,
      sort: row.sort,
      builtin: BUILTIN_CATEGORIES.some((c) => c.id === row.id),
      stored: true,
    });
  }
  return [...byId.values()].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

export const findCategory = (cats: Category[], id: CategoryId): Category | undefined =>
  cats.find((c) => c.id === id);

export const categoryLabel = (cats: Category[], id: CategoryId): string =>
  findCategory(cats, id)?.label ?? id;

export const categoryColor = (cats: Category[], id: CategoryId): string =>
  findCategory(cats, id)?.color ?? UNKNOWN_CATEGORY_COLOR;

/** A slug the `app_categories_id_slug` check constraint will accept. */
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 31);
  return /^[a-z]/.test(slug) ? slug : `c-${slug}`.slice(0, 31);
}

export type CategoryContextValue = {
  /** Built-ins merged with whatever the admin has stored. Never empty. */
  categories: Category[];
  loading: boolean;
  /** Re-read `app_categories`; called after the admin edits the list. */
  refresh: () => Promise<void>;
};

/**
 * Default value rather than `null`: the category list has a meaningful answer
 * without a provider (SSR, and the signed-out case where RLS returns nothing),
 * so no consumer needs a guard.
 */
export const CategoryContext = createContext<CategoryContextValue>({
  categories: BUILTIN_CATEGORIES,
  loading: false,
  refresh: async () => {},
});

/**
 * Lives here rather than beside `<CategoryProvider>` so that provider module
 * exports a component and nothing else — see the note in `auth-context.ts`.
 */
export function useCategories(): CategoryContextValue {
  return useContext(CategoryContext);
}
