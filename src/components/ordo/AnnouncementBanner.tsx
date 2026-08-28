import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import type { Announcement } from "@/lib/db";
import { levelStyle } from "@/lib/announcement-levels";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const KEY = "ordo.announcements.dismissed";

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

/**
 * Admin announcements, above the app. Dismissal is per-browser and by id, so a
 * new announcement still shows after the last one was closed, and closing one
 * never hides it on another device.
 */
export function AnnouncementBanner() {
  const { token } = useAuth();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => setDismissed(readDismissed()), []);

  useEffect(() => {
    if (!token) {
      setRows([]);
      return;
    }
    let active = true;
    void db
      .listAnnouncements()
      .then((list) => {
        if (active) setRows(list.filter((r) => r.active));
      })
      // A failed read must not interrupt the app; the banner just stays away.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token]);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next.slice(-50)));
      } catch {
        /* private-mode storage: dismissal simply does not persist */
      }
      return next;
    });
  }, []);

  const visible = rows.filter((r) => !dismissed.includes(r.id));
  if (!visible.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {visible.map((r) => {
        const look = levelStyle(r.level);
        return (
          <div
            key={r.id}
            role="status"
            className="flex items-start gap-2.5 rounded-lg border p-3"
            style={{
              borderColor: `color-mix(in oklab, ${look.color} 45%, transparent)`,
              backgroundColor: `color-mix(in oklab, ${look.color} 10%, transparent)`,
            }}
          >
            <look.icon className="mt-0.5 size-4 shrink-0" style={{ color: look.color }} />
            <div className="min-w-0 flex-1 text-sm">
              {r.title ? <p className="font-medium">{r.title}</p> : null}
              <p className="whitespace-pre-wrap break-words text-muted-foreground">{r.body}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="tap -mr-1 -mt-1 shrink-0"
              aria-label="Dismiss announcement"
              onClick={() => dismiss(r.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
