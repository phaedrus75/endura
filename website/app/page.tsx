import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AppGallery from "@/components/AppGallery";
import Founder from "@/components/Founder";
import GlobalCommunity from "@/components/GlobalCommunity";
import Mission from "@/components/Mission";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <AppGallery />
      <Founder />
      <GlobalCommunity />
      <Mission />
      <Footer />
    </main>
  );
}
