import { Link, useLocation } from "react-router-dom";
import { Music, Trophy, Library, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = ({ variant = "light" }: { variant?: "light" | "dark" }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const dark = variant === "dark";
  const { user, profile, signOut } = useAuth();

  return (
    <nav className={`sticky top-0 z-50 border-b backdrop-blur-md ${dark ? "border-white/10 bg-black/30" : "border-border bg-card/80"}`}>
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform duration-200 group-hover:scale-95">
            <Music className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className={`text-lg font-bold tracking-tight ${dark ? "text-white" : ""}`}>
            Ethio<span className="text-primary">Tiles</span>
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {[
            { to: "/", label: "Home" },
            { to: "/library", label: "Library", icon: Library },
            { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
          ].map(({ to, label }) => (
            <Link key={to} to={to}>
              <Button
                variant={isActive(to) ? "secondary" : "ghost"}
                size="sm"
                className={`text-xs font-medium ${dark && !isActive(to) ? "text-white/70 hover:text-white hover:bg-white/10" : ""}`}
              >
                {label}
              </Button>
            </Link>
          ))}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={`gap-2 text-xs ${dark ? "text-white/80 hover:text-white hover:bg-white/10" : ""}`}>
                  <User className="h-4 w-4" />
                  {profile?.display_name ?? "Player"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile?.display_name}
                  {profile?.is_guest && <span className="ml-2 text-xs text-muted-foreground">(guest)</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="gap-2 text-xs">
                <LogIn className="h-4 w-4" /> Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
