import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Music2 } from "lucide-react";
import { useEffect, useRef } from "react";

const HeroSection = () => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("animate-reveal-up");
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative overflow-hidden bg-surface-sunken">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/3" />
      </div>

      <div ref={ref} className="container relative flex flex-col items-center gap-8 py-24 text-center opacity-0 lg:py-32">
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium shadow-sm">
          <Music2 className="h-3.5 w-3.5 text-primary" />
          Ethiopian Music Rhythm Game
        </div>

        <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl text-balance">
          Tap to the beat of{" "}
          <span className="text-primary">Ethiopia's</span>{" "}
          greatest hits
        </h1>

        <p className="max-w-xl text-lg text-muted-foreground text-balance leading-relaxed">
          Play along with legendary Ethiopian artists. From Ethio-Jazz to modern pop — 
          test your rhythm and climb the leaderboard.
        </p>

        <div className="flex items-center gap-3">
          <Button size="lg" onClick={() => navigate("/library")} className="gap-2 px-6 shadow-md">
            <Play className="h-4 w-4" />
            Start Playing
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/library")}>
            Browse Songs
          </Button>
        </div>

        <div className="flex items-center gap-8 pt-4 text-sm text-muted-foreground">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">12+</span>
            <span>Songs</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">5</span>
            <span>Genres</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">3</span>
            <span>Difficulty Levels</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
