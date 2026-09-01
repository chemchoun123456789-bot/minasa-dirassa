import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, GraduationCap } from 'lucide-react';
import { TELEGRAM_URL, PLATFORM_URL } from '../lib/constants';

const links = [
  { label: 'الأدوات', href: '#features' },
  { label: 'عن المنصة', href: '#about' },
  { label: 'انضم إلينا', href: '#join' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-4 sm:pt-4"
    >
      <nav
        className={`flex w-full max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-500 sm:px-5 sm:py-3 ${
          scrolled ? 'glass-nav shadow-[0_8px_32px_rgba(0,0,0,0.45)]' : 'border border-transparent'
        }`}
      >
        <a
         href={PLATFORM_URL}
         target="_blank"
         rel="noopener noreferrer"
         className="flex items-center gap-2.5"
        >
         <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/15 sm:h-9 sm:w-9">
           <img 
           src="/assets/icon.jpg" 
           alt="شعار منصة دراسة" 
           className="h-full w-full object-cover" 
          />
         </span>
         <span className="text-base font-semibold tracking-tight sm:text-lg">
          منصّة <span className="font-light text-smoke">دراسة</span>
         </span>
        </a>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-mist transition-colors duration-300 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-paper px-3.5 py-2 text-sm font-semibold text-ink transition-colors duration-300 hover:bg-white sm:px-4"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">انضم عبر تلغرام</span>
          <span className="sm:hidden">تلغرام</span>
        </a>
      </nav>
    </motion.header>
  );
}
