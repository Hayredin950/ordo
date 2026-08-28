/**
 * How each announcement level looks. Shared by the admin editor and the banner
 * every user sees, and kept out of both components so neither module exports a
 * mix of components and helpers (Fast Refresh remounts the tree when it does).
 */
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import type { AnnouncementLevel } from "./db";

export type LevelStyle = {
  id: AnnouncementLevel;
  label: string;
  icon: LucideIcon;
  color: string;
};

export const LEVELS: LevelStyle[] = [
  { id: "info", label: "Info", icon: Info, color: "var(--cat-study)" },
  { id: "success", label: "Good news", icon: CheckCircle2, color: "var(--cat-health)" },
  { id: "warning", label: "Heads-up", icon: AlertTriangle, color: "var(--cat-work)" },
];

/** An unknown level from a future migration still renders, as plain info. */
export const levelStyle = (level: AnnouncementLevel): LevelStyle =>
  LEVELS.find((l) => l.id === level) ?? LEVELS[0]!;
