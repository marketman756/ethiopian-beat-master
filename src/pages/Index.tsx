import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturedSongs from "@/components/FeaturedSongs";
import GameModes from "@/components/GameModes";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1">
      <HeroSection />
      <FeaturedSongs />
      <GameModes />
    </main>
    <Footer />
  </div>
);

export default Index;
