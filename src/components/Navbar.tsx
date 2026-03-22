import { Link, useLocation } from "react-router-dom";
import { Music, Trophy, User, Library } from "lucide-react";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary transition-transform duration-200 group-hover:scale-95 group-active:scale-90">
            <Music className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Ethio<span className="text-primary">Tiles</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {[
            { to: "/", label: "Home" },
            { to: "/library", label: "Library", icon: Library },
            { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
          ].map(({ to, label }) => (
            <Link key={to} to={to}>
              <Button
                variant={isActive(to) ? "secondary" : "ghost"}
                size="sm"
                className="font-medium"
              >
                {label}
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-4 w-4" />
          </Button>
          <Button size="sm" className="hidden sm:inline-flex">
            Play Now
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
