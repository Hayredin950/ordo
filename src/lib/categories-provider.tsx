import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { listCategories } from "./db";
import {
  BUILTIN_CATEGORIES,
  CategoryContext,
  mergeCategories,
  type CategoryContextValue,
  type CategoryRow,
} from "./categories";

/**
 * Loads the admin-managed category rows once a session exists and merges them
 * over the built-ins. `app_categories` is readable by any signed-in client, so a
 * signed-out visitor (and SSR) simply keeps the six code-defined categories.
 */
export function CategoryProvider({ children }: { children: ReactNode }) {
  const { token, configured } = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!configured || !token) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      setRows(await listCategories());
    } catch {
      // A failed read is not worth an error state: the built-ins still render.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [configured, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CategoryContextValue>(
    () => ({
      categories: rows.length ? mergeCategories(rows) : BUILTIN_CATEGORIES,
      loading,
      refresh,
    }),
    [rows, loading, refresh],
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}
