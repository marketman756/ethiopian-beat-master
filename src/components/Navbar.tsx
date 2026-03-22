import { Link, useLocation } from "react-router-dom";
import { Music, Trophy, Library } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = ({ variant = "light" }: { variant?: "light" | "dark" }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const dark = variant === "dark";

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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
