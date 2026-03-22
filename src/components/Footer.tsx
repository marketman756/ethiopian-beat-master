import { Music } from "lucide-react";

const Footer = ({ variant = "light" }: { variant?: "light" | "dark" }) => {
  const dark = variant === "dark";
  return (
    <footer className={`border-t py-8 ${dark ? "border-white/10 bg-black/20" : "border-border bg-card"}`}>
      <div className="container flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Music className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className={`text-sm font-semibold ${dark ? "text-white" : ""}`}>EthioTiles</span>
        </div>
        <p className={`text-sm ${dark ? "text-white/40" : "text-muted-foreground"}`}>
          © 2026 EthioTiles. Celebrating Ethiopian music through rhythm gaming.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
