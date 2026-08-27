import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — Ordo" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, signup, codeRequest, codeVerify, oauthSignIn, health, user, configured } =
    useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "code" | "verify">("login");
  /** Which email the pending code came from, so the copy matches. */
  const [pending, setPending] = useState<"signup" | "signin">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  /**
   * Supabase refuses a second email inside `auth.email.max_frequency` (a minute
   * here), so the resend button counts down instead of handing back an error.
   */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (user) {
    return (
      <div className="px-safe flex min-h-dvh items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Already signed in</CardTitle>
            <CardDescription>You're logged in as {user.email}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/" className="block">
              <Button className="tap w-full">Back to Ordo</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const askForCode = (kind: "signup" | "signin") => {
    setPending(kind);
    setCode("");
    setCooldown(60);
    setMode("verify");
    toast.success("Check your email", {
      description: `We sent a 6-digit code to ${email}.`,
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        // "code" means confirmation is on and the account is not usable yet.
        if ((await signup(email, password, name || undefined)) === "code") {
          askForCode("signup");
        } else {
          toast.success("Account created — welcome to Ordo");
        }
      } else if (mode === "login") {
        await login(email, password);
        toast.success("Signed in");
      } else {
        await codeRequest(email);
        askForCode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setBusy(true);
    try {
      await codeVerify(email, code);
      toast.success(pending === "signup" ? "Email confirmed — welcome to Ordo" : "Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await codeRequest(email);
      setCooldown(60);
      toast.success("New code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "github" | "google") => {
    setBusy(true);
    try {
      await oauthSignIn(provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="px-safe flex min-h-dvh items-center justify-center px-4 py-8">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img
            src="/logo-icon.png"
            alt="Ordo logo"
            className="mx-auto mb-3 size-20 sm:mb-4 sm:size-24"
          />
          <CardTitle className="font-display text-2xl">Ordo</CardTitle>
          <CardDescription>
            Discipline, measured. Sign in to sync your accountability data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              This deployment has no Supabase credentials. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY, then redeploy.
            </p>
          ) : null}
          {/* Flex rather than a two-column grid: with a single provider enabled a
              grid would leave a dead half-row. */}
          <div className="flex flex-wrap gap-2">
            {health?.github ? (
              <Button
                variant="outline"
                className="tap flex-1 basis-32"
                disabled={busy}
                onClick={() => void oauth("github")}
              >
                <Github className="mr-2 size-4" /> GitHub
              </Button>
            ) : null}
            {health?.google ? (
              <Button
                variant="outline"
                className="tap flex-1 basis-32"
                disabled={busy}
                onClick={() => void oauth("google")}
              >
                <Mail className="mr-2 size-4" /> Google
              </Button>
            ) : null}
          </div>
          {health?.github || health?.google ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or{" "}
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          {mode === "verify" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="code">
                  {pending === "signup" ? "Confirmation code" : "Sign-in code"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {pending === "signup"
                    ? "Enter the 6-digit code we emailed to confirm this address."
                    : "Enter the 6-digit code we emailed you."}{" "}
                  Sent to <span className="font-medium text-foreground">{email}</span>.
                </p>
              </div>
              <Input
                id="code"
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="h-12 text-center font-mono text-lg tracking-[0.4em] md:h-12 md:text-lg"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) void submitCode();
                }}
              />
              <Button
                className="tap w-full"
                disabled={busy || code.length < 6}
                onClick={() => void submitCode()}
              >
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {pending === "signup" ? "Confirm email" : "Sign in"}
              </Button>
              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="link"
                  size="sm"
                  className="tap"
                  disabled={busy || cooldown > 0}
                  onClick={() => void resend()}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="tap w-full"
                  onClick={() => {
                    setCode("");
                    setMode("login");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode !== "code" ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No password needed — we email you a 6-digit code instead.
                </p>
              )}

              <Button className="tap w-full" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Email me a code"}
              </Button>

              <div className="flex flex-wrap justify-center gap-1 text-sm">
                {mode === "login" ? (
                  <>
                    <Button
                      variant="link"
                      size="sm"
                      className="tap"
                      onClick={() => setMode("signup")}
                    >
                      Create an account
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="tap"
                      onClick={() => setMode("code")}
                    >
                      Sign in with a code
                    </Button>
                  </>
                ) : mode === "signup" ? (
                  <Button variant="link" size="sm" className="tap" onClick={() => setMode("login")}>
                    Already have an account?
                  </Button>
                ) : (
                  <Button variant="link" size="sm" className="tap" onClick={() => setMode("login")}>
                    Back to sign in
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
