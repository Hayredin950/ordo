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
  const { login, signup, magicRequest, magicVerify, health, user } = useAuth();
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
        const res = await magicRequest(email);
        toast.success("Check the server console for your code", {
          description: res.devCode ? `Dev code: ${res.devCode}` : undefined,
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
          <div className="grid grid-cols-2 gap-2">
            {health?.github ? (
              <a href={`${import.meta.env["VITE_API_URL"] ?? "http://localhost:8787"}/api/auth/github`}>
                <Button variant="outline" className="w-full">
                  <Github className="mr-2 size-4" /> GitHub
                </Button>
              </a>
            ) : null}
            {health?.google ? (
              <a href={`${import.meta.env["VITE_API_URL"] ?? "http://localhost:8787"}/api/auth/google`}>
                <Button variant="outline" className="w-full">
                  <Mail className="mr-2 size-4" /> Google
                </Button>
              </a>
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
                placeholder="A1B2C3"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
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
