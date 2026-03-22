import { Zap, Users, GraduationCap } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const modes = [
  {
    icon: Zap,
    title: "Solo Play",
    description: "Play at your own pace. Perfect your timing on any song in the library.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Users,
    title: "Challenge Mode",
    description: "Compete head-to-head with friends and climb the global rankings.",
    color: "bg-blue-50 text-primary",
  },
  {
    icon: GraduationCap,
    title: "Learn & Practice",
    description: "Step-by-step tutorials to master rhythm patterns and improve your score.",
    color: "bg-emerald-50 text-emerald-600",
  },
];

const GameModes = () => {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="bg-surface-sunken py-20 opacity-0">
      <div className="container">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Game Modes</h2>
          <p className="mt-1 text-muted-foreground">Choose how you want to play</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {modes.map((mode, i) => (
            <div
              key={mode.title}
              className="flex flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${mode.color}`}>
                <mode.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold">{mode.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{mode.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GameModes;
