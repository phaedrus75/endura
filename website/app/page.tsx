import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import AppGallery from "@/components/AppGallery";
import HowItWorks from "@/components/HowItWorks";
import Founder from "@/components/Founder";
import Mission from "@/components/Mission";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <AppGallery />
      <HowItWorks />
      <Founder />
      <Mission />
      <Footer />
    </main>
  );
}
