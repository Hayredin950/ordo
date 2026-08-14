import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Panel, PanelTitle } from "./primitives";
import { Button } from "@/components/ui/button";
import { Users, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Block } from "@/lib/ordo";

type PublicTemplate = {
  id: string;
  author_name: string;
  name: string;
  blocks: Block[];
  copies: number;
  created_at: string;
};

export function PublicTemplates({
  onApply,
  dayIdx,
}: {
  onApply: (blocks: Block[]) => void;
  dayIdx: number;
}) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<PublicTemplate[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ templates: PublicTemplate[] }>("/api/templates/public");
      setTemplates(res.templates);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (t: PublicTemplate) => {
    if (!user) {
      toast.info("Sign in to copy shared templates");
      return;
    }
    setBusyId(t.id);
    try {
      const res = await apiFetch<{ name: string; blocks: Block[] }>(`/api/templates/${t.id}/copy`, {
        method: "POST",
        json: {},
      });
      onApply(res.blocks);
      toast.success(`Applied “${res.name}” to day ${dayIdx}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy template");
    } finally {
      setBusyId(null);
    }
  };

  if (!templates?.length) return null;

  return (
    <Panel>
      <PanelTitle title="Shared template library" hint="Routines others published — copy any into your schedule." />
      <div className="space-y-2">
        {templates.slice(0, 6).map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{t.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                by {t.author_name} · {t.blocks.length} blocks · {t.copies} copies
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={busyId === t.id} onClick={() => void copy(t)}>
              {busyId === t.id ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}
