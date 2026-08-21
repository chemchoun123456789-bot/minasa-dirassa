import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Marquee from './components/Marquee';
import Features from './components/Features';
import About from './components/About';
import CTA from './components/CTA';
import Preview from './components/Preview';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink text-paper">
      <div className="noise-overlay" aria-hidden="true" />
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <About />
        <CTA />
        <Preview />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
