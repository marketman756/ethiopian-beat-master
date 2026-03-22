import { Music } from "lucide-react";

const Footer = () => (
  <footer className="border-t bg-card py-10">
    <div className="container flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Music className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold">EthioTiles</span>
      </div>
      <p className="text-sm text-muted-foreground">
        © 2026 EthioTiles. Celebrating Ethiopian music through rhythm gaming.
      </p>
    </div>
  </footer>
);

export default Footer;
