import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import * as db from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelTitle } from "./primitives";
import { Copy, Check, Loader2, Send, Hash, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

type TelegramStatus = {
  configured: boolean;
  botUsername: string;
  linked: { chatId: string; username: string } | null;
};

type SlackStatus = {
  configured: boolean;
  linked: { channel: string } | null;
};

export function TelegramPanel() {
  const { user, health } = useAuth();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Slack channel
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [slackChannel, setSlackChannel] = useState("");
  const [slackBusy, setSlackBusy] = useState(false);

  const refreshSlack = useCallback(async () => {
    if (!user) return;
    try {
      setSlack({ configured: health?.slack ?? false, linked: await db.slackLink() });
    } catch {
      setSlack(null);
    }
  }, [user, health]);

  useEffect(() => {
    void refreshSlack();
  }, [refreshSlack]);

  const linkSlack = async () => {
    if (!user || !slackChannel.trim()) return;
    setSlackBusy(true);
    try {
      const channel = await db.linkSlack(user.id, slackChannel.trim());
      setSlack((s) => (s ? { ...s, linked: { channel } } : s));
      setSlackChannel("");
      toast.success(`Slack linked to ${channel}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link Slack");
    } finally {
      setSlackBusy(false);
    }
  };

  const unlinkSlack = async () => {
    if (!user) return;
    setSlackBusy(true);
    try {
      await db.unlinkSlack(user.id);
      setSlack((s) => (s ? { ...s, linked: null } : s));
      toast.success("Slack unlinked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlink Slack");
    } finally {
      setSlackBusy(false);
    }
  };

  const refresh = useCallback(async (): Promise<TelegramStatus | null> => {
    if (!user) return null;
    try {
      const s: TelegramStatus = {
        configured: health?.telegram ?? false,
        botUsername: health?.telegramBot ?? "",
        linked: await db.telegramLink(),
      };
      setStatus(s);
      return s;
    } catch {
      setStatus(null);
      return null;
    }
  }, [user, health]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll for a successful link while a code is outstanding.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => {
      void refresh().then((s) => {
        if (s?.linked) setCode(null);
      });
    }, 3000);
    return () => clearInterval(t);
  }, [code, refresh]);

  const configured = health?.telegram ?? false;

  if (!user) {
    return (
      <Panel>
        <PanelTitle title="Notification channels" hint="Sign in to link the nagging channel." />
        <p className="text-sm text-muted-foreground">Sign in to connect Telegram or Slack.</p>
      </Panel>
    );
  }

  const generate = async () => {
    setBusy(true);
    try {
      const linkCode = await db.createTelegramCode();
      setCode(linkCode);
      const bot = health?.telegramBot ?? "";
      toast.info("Send this code to the bot", {
        description: `Open Telegram → @${bot || "your bot"} → /link ${linkCode}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create link code");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setBusy(true);
    try {
      await db.unlinkTelegram(user.id);
      setStatus((s) => (s ? { ...s, linked: null } : s));
      toast.success("Unlinked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlink");
    } finally {
      setBusy(false);
    }
  };

  const slackConfigured = health?.slack ?? false;

  return (
    <Panel>
      <PanelTitle
        title="Notification channels"
        hint="Telegram-first, Slack as a second option — one shared service."
      />
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Telegram
      </p>
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Bot not configured on the server yet. Set{" "}
          <code className="rounded bg-muted px-1">TELEGRAM_BOT_TOKEN</code> to activate reminders,
          nags and check-ins.
        </p>
      ) : status?.linked ? (
        <div className="space-y-3 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Check className="size-4 shrink-0 text-primary" /> Linked to chat{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {status.linked.chatId}
            </span>
            {status.linked.username ? ` (@${status.linked.username})` : ""}
          </p>
          <p className="text-muted-foreground">
            You'll get 10-minute reminders, nags and the 21:00 check-in here.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="tap w-full sm:w-auto"
            disabled={busy}
            onClick={() => void unlink()}
          >
            Unlink this chat
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Open the bot and send <b>/link CODE</b> to bind this account to a chat.
          </p>
          {code ? (
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <span className="min-w-0 flex-1 break-all font-mono text-lg font-bold tracking-widest">
                {code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="tap shrink-0"
                aria-label="Copy code"
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                  toast.success("Code copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="tap w-full sm:w-auto"
              disabled={busy}
              onClick={() => void generate()}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Generate link code
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {status?.botUsername
              ? `Bot: @${status.botUsername}`
              : "Bot username not set (TELEGRAM_BOT_USERNAME)."}{" "}
            Code expires in 15 minutes.
          </p>
        </div>
      )}

      <div className="my-4 border-t border-border" />
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Slack
      </p>
      {!slackConfigured ? (
        <p className="text-sm text-muted-foreground">
          Slack not configured on the server. Set{" "}
          <code className="rounded bg-muted px-1">SLACK_BOT_TOKEN</code> to receive reminders here
          too.
        </p>
      ) : slack?.linked ? (
        <div className="space-y-2 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Check className="size-4 shrink-0 text-primary" /> Linked to{" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {slack.linked.channel}
            </span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="tap w-full sm:w-auto"
            disabled={slackBusy}
            onClick={() => void unlinkSlack()}
          >
            <Unlink className="mr-1 size-4" /> Unlink Slack
          </Button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Add your workspace channel (e.g. <b>#daily</b>) and reminders, nags and reports go there
            too.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={slackChannel}
              placeholder="#general"
              aria-label="Slack channel"
              onChange={(e) => setSlackChannel(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              className="tap w-full sm:w-auto sm:shrink-0"
              disabled={slackBusy}
              onClick={() => void linkSlack()}
            >
              {slackBusy ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Link2 className="mr-1 size-4" />
              )}
              Link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Hash className="mr-1 inline size-3" />
            The bot needs to be invited to that channel.
          </p>
        </div>
      )}
    </Panel>
  );
}
