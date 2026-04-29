import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Music } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await signIn(String(fd.get("email")), String(fd.get("password")));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate("/library");
  };

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await signUp(
      String(fd.get("email")),
      String(fd.get("password")),
      String(fd.get("display_name")),
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email to verify your account");
  };

  const handleGuest = async () => {
    setBusy(true);
    const name = `Guest${Math.floor(Math.random() * 9000 + 1000)}`;
    const { error } = await signInAsGuest(name);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Playing as ${name}`);
    navigate("/library");
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    setBusy(false);
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Music className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold">Ethio<span className="text-primary">Tiles</span></span>
      </Link>

      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="si-password">Password</Label>
                <Input id="si-password" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Sign in</Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="su-name">Display name</Label>
                <Input id="su-name" name="display_name" required minLength={2} maxLength={32} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>Create account</Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleGuest} disabled={busy}>
            Play as guest
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;