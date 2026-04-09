import TopBanner from "@/components/TopBanner";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AppGallery from "@/components/AppGallery";
import Founder from "@/components/Founder";
import Mission from "@/components/Mission";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <TopBanner />
      <Navbar />
      <Hero />
      <AppGallery />
      <Founder />
      <Mission />
      <Footer />
    </main>
  );
}
