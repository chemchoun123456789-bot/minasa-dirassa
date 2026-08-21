import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Send, ArrowDown, ArrowUpLeft, GraduationCap } from 'lucide-react';
import { TELEGRAM_URL, PLATFORM_URL } from '../lib/constants';

// code-split: three.js loads in its own chunk, after first paint
const Scene3D = lazy(() => import('./Scene3D'));

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function Hero() {
  const { scrollY } = useScroll();
  const contentY = useTransform(scrollY, [0, 600], [0, 110]);
  const contentOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const sceneY = useTransform(scrollY, [0, 600], [0, -70]);

  /* pause the 3D render loop when the hero leaves the viewport */
  const sectionRef = useRef<HTMLElement>(null);
  const [sceneActive, setSceneActive] = useState(true);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setSceneActive(entry.isIntersecting),
      { rootMargin: '80px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="grid-bg relative flex min-h-screen items-center overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 75% 65% at 50% 38%, transparent 0%, #070707 88%)',
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-6 px-5 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-2 lg:pt-24">
        {/* text column */}
        <motion.div style={{ y: contentY, opacity: contentOpacity }} className="text-right">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
            className="flex items-center"
          >
            <span className="glass-chip inline-flex items-center gap-2.5 rounded-full py-1.5 pl-4 pr-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-paper" />
              </span>
              <span className="text-xs font-medium tracking-wide text-mist">
                منصّة مجانية للطلاب العرب
              </span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.28, ease: EASE }}
            className="mt-6 text-[2.1rem] font-bold leading-[1.3] tracking-tight sm:text-5xl lg:text-[3.3rem]"
          >
            كل ما تحتاجه لإدارة
            <br />
            حياتك الدراسية
            <br />
            <span className="font-light text-smoke">في مكان واحد.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.42, ease: EASE }}
            className="mt-6 max-w-md text-base leading-loose text-smoke sm:text-lg"
          >
            نظّم وقتك، ارفع تركيزك، وتابع إنجازاتك اليومية بسلاسة. جدولك ومهامك
            وملاحظاتك وعلاماتك، كلها في واجهة واحدة بدل عشرة تطبيقات متفرقة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.56, ease: EASE }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          >
            {/* primary: open the platform */}
            <a
              href={PLATFORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-solid group flex w-full items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 text-base font-semibold text-ink sm:w-auto"
            >
              <GraduationCap className="h-5 w-5" strokeWidth={1.8} />
              افتح منصّة دراسة
              <ArrowUpLeft className="h-4 w-4 opacity-60 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            {/* secondary: telegram */}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-liquid group flex w-full items-center justify-center gap-2.5 rounded-xl px-7 py-3.5 text-base font-medium text-mist hover:text-white sm:w-auto"
            >
              <Send className="h-4.5 w-4.5 transition-transform duration-300 group-hover:-translate-x-1" />
              قناة تلغرام
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.85 }}
            className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/8 pt-6"
          >
            {[
              { value: '٧', label: 'أدوات دراسية' },
              { value: '٠', label: 'تكلفة الاشتراك' },
              { value: 'أسبوعيًا', label: 'تحديثات وتحسينات' },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <span className="text-xl font-semibold text-white">{s.value}</span>
                <span className="text-xs text-smoke">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* 3D column — lazy-loaded, paused off-screen, unclipped */}
        <motion.div
          style={{ y: sceneY }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
          className="relative h-[340px] overflow-visible sm:h-[440px] lg:h-[620px]"
        >
          <Suspense fallback={null}>
            <Scene3D active={sceneActive} />
          </Suspense>
        </motion.div>
      </div>

      {/* scroll hint (desktop only) */}
      <motion.a
        href="#features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-smoke transition-colors hover:text-white lg:block"
        aria-label="مرر للأسفل"
      >
        <motion.div animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ArrowDown className="h-5 w-5" strokeWidth={1.5} />
        </motion.div>
      </motion.a>
    </section>
  );
}
