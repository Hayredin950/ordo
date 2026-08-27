import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
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
  const { login, signup, magicRequest, magicVerify, oauthSignIn, health, user, configured } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "magic" | "magic-verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Already signed in</CardTitle>
            <CardDescription>You're logged in as {user.email}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/" className="block">
              <Button className="w-full">Back to Ordo</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(email, password, name || undefined);
        toast.success("Account created — welcome to Ordo");
      } else if (mode === "login") {
        await login(email, password);
        toast.success("Signed in");
      } else {
        await magicRequest(email);
        toast.success("Check your inbox", {
          description: "Open the link, or paste the 6-digit code below.",
        });
        setMode("magic-verify");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const submitMagic = async () => {
    setBusy(true);
    try {
      await magicVerify(email, code);
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <Toaster />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <img src="/logo-icon.png" alt="Ordo logo" className="mx-auto mb-4 h-24 w-24" />
          <CardTitle className="font-display text-2xl">Ordo</CardTitle>
          <CardDescription>Discipline, measured. Sign in to sync your accountability data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              This deployment has no Supabase credentials. Set VITE_SUPABASE_URL and
              VITE_SUPABASE_ANON_KEY, then redeploy.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {health?.github ? (
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => void oauth("github")}>
                <Github className="mr-2 size-4" /> GitHub
              </Button>
            ) : null}
            {health?.google ? (
              <Button variant="outline" className="w-full" disabled={busy} onClick={() => void oauth("google")}>
                <Mail className="mr-2 size-4" /> Google
              </Button>
            ) : null}
          </div>
          {health?.github || health?.google ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          {mode === "magic-verify" ? (
            <div className="space-y-2">
              <Label htmlFor="code">Magic code</Label>
              <Input
                id="code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
              />
              <Button className="w-full" disabled={busy} onClick={submitMagic}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Verify code
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("login")}>
                Back
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {mode === "signup" ? (
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
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
              {mode !== "magic" ? (
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
              ) : null}

              <Button className="w-full" disabled={busy} onClick={submit}>
                {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send magic link"}
              </Button>

              <div className="flex flex-wrap justify-center gap-1 text-sm">
                {mode === "login" ? (
                  <>
                    <Button variant="link" size="sm" onClick={() => setMode("signup")}>
                      Create an account
                    </Button>
                    <Button variant="link" size="sm" onClick={() => setMode("magic")}>
                      Use a magic link
                    </Button>
                  </>
                ) : mode === "signup" ? (
                  <Button variant="link" size="sm" onClick={() => setMode("login")}>
                    Already have an account?
                  </Button>
                ) : (
                  <Button variant="link" size="sm" onClick={() => setMode("login")}>
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
