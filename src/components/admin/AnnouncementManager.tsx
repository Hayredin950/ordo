import { useCallback, useEffect, useState } from "react";
import * as db from "@/lib/db";
import type { Announcement, AnnouncementLevel } from "@/lib/db";
import { LEVELS, levelStyle } from "@/lib/announcement-levels";
import { useAuth } from "@/lib/auth-context";
import { Panel, PanelTitle, SegButton } from "@/components/ordo/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Announcements are read by every signed-in client while `active` is true, so
 * retiring one is the normal way to take it down — deleting is for mistakes.
 */
export function AnnouncementManager() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("info");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await db.listAnnouncements());
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async () => {
    if (!user || !body.trim()) {
      toast.error("Write the message first");
      return;
    }
    setBusy(true);
    try {
      await db.createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        level,
        userId: user.id,
      });
      setTitle("");
      setBody("");
      await load();
      toast.success("Posted — every signed-in user sees it on their next load");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post the announcement");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: Announcement) => {
    try {
      await db.setAnnouncementActive(row.id, !row.active);
      setRows((rs) =>
        rs ? rs.map((r) => (r.id === row.id ? { ...r, active: !r.active } : r)) : rs,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update it");
    }
  };

  const remove = async (row: Announcement) => {
    try {
      await db.deleteAnnouncement(row.id);
      setRows((rs) => (rs ? rs.filter((r) => r.id !== row.id) : rs));
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete it");
    }
  };

  return (
    <Panel>
      <PanelTitle
        title="Announcements"
        hint="A banner above every user's dashboard. Keep it short."
      />

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Announcement level">
          {LEVELS.map((l) => (
            <SegButton key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
              <l.icon className="mr-1 inline size-3.5" />
              {l.label}
            </SegButton>
          ))}
        </div>
        <Input
          value={title}
          maxLength={80}
          placeholder="Title (optional)"
          aria-label="Announcement title"
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          value={body}
          rows={3}
          maxLength={500}
          placeholder="e.g. Two new categories are live — Volunteering and Side project."
          aria-label="Announcement body"
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{body.length}/500</span>
          <Button
            size="sm"
            className="tap"
            disabled={busy || !body.trim()}
            onClick={() => void post()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
            Post
          </Button>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {rows?.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing posted yet.</p>
        ) : null}
        {rows?.map((r) => {
          const look = levelStyle(r.level);
          return (
            <li key={r.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
              <div className="flex items-start gap-2">
                <look.icon className="mt-0.5 size-4 shrink-0" style={{ color: look.color }} />
                <div className="min-w-0 flex-1">
                  {r.title ? <p className="truncate font-medium">{r.title}</p> : null}
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">{r.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()} · {r.active ? "live" : "retired"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="tap flex-1 sm:flex-none"
                  onClick={() => void toggle(r)}
                >
                  {r.active ? "Retire" : "Show again"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="tap shrink-0"
                  aria-label="Delete announcement"
                  onClick={() => void remove(r)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
