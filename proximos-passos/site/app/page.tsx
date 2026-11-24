import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Bands from "@/components/Bands";
import Ideia from "@/components/Ideia";
import Recursos from "@/components/Recursos";
import Integracoes from "@/components/Integracoes";
import Alertas from "@/components/Alertas";
import Marca from "@/components/Marca";
import PraQuem from "@/components/PraQuem";
import NaRua from "@/components/NaRua";
import AppSection from "@/components/AppSection";
import Planos from "@/components/Planos";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import SiteFx from "@/components/SiteFx";

export default function Page() {
  return (
    <div style={{ background: "#0B0B0B", color: "#FFFFFF", overflowX: "clip" }}>
      <Header />
      <main>
        <Hero />
        <Bands />
        <Ideia />
        <Recursos />
        <Integracoes />
        <Alertas />
        <Marca />
        <PraQuem />
        <NaRua />
        <AppSection />
        <Planos />
        <Faq />
      </main>
      <Footer />
      <ChatWidget />
      <SiteFx />
    </div>
  );
}
