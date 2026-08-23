import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { GraduationCap, ArrowUpLeft, Lock } from 'lucide-react';
import { PLATFORM_URL } from '../lib/constants';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function Preview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [maxPan, setMaxPan] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    mass: 0.4,
    restDelta: 0.0005,
  });

  /* Phase 1 (0 → 0.22): the device rises, un-tilts and scales up */
  const rotateX = useTransform(smooth, [0, 0.22], [24, 0]);
  const frameScale = useTransform(smooth, [0, 0.22], [0.88, 1]);
  const frameY = useTransform(smooth, [0, 0.22], [90, 0]);

  /* Phase 2 (0.28 → 0.92): auto-tour — the screenshot pans through the app.
     Clamp v to [0,1] so the spring can never overshoot past the image edges. */
  const panT = useTransform(smooth, [0.28, 0.92], [0, 1]);
  const imgY = useTransform(panT, (v) => -Math.min(1, Math.max(0, v)) * maxPan);

  /* Tour progress bar */
  const progressScale = useTransform(smooth, [0.28, 0.92], [0, 1]);

  /* measure how far the tall screenshot can travel inside the viewport */
  useEffect(() => {
    const measure = () => {
      if (frameRef.current && imgRef.current) {
        setMaxPan(Math.max(0, imgRef.current.offsetHeight - frameRef.current.clientHeight));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <section id="preview" className="relative border-t border-white/8">
      {/* section badge */}
      <div className="mx-auto max-w-6xl px-5 pt-20 sm:px-6 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex items-center gap-4"
        >
          <span className="glass-chip inline-flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5">
            <span
              dir="ltr"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-[11px] font-semibold text-ink"
            >
              04
            </span>
            <span className="text-xs font-medium tracking-wide text-mist">لقطات من المنصة</span>
          </span>
          <span className="h-px max-w-40 flex-1 bg-gradient-to-l from-white/20 to-transparent" />
        </motion.div>
      </div>

      {/* ── sticky scroll tour ─────────────────────────────── */}
      <div ref={sectionRef} className="relative h-[300vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-4">
          {/* grid backdrop, faded softly at the edges — sits behind the content */}
          <div
            className="grid-bg pointer-events-none absolute inset-0 opacity-55"
            style={{
              maskImage:
                'radial-gradient(ellipse 80% 75% at 50% 50%, black 30%, transparent 92%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 80% 75% at 50% 50%, black 30%, transparent 92%)',
            }}
          />

          {/* heading */}
          <div className="relative z-10 mb-8 text-center sm:mb-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              المنصة <span className="font-light text-smoke">من الداخل</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-smoke sm:text-base">
              تابع التمرير، وستعبر أمامك لوحة التحكم قسمًا بعد قسم.
            </p>
            {/* tour progress */}
            <div dir="ltr" className="mx-auto mt-5 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
              <motion.div
                style={{ scaleX: progressScale }}
                className="h-full w-full origin-left rounded-full bg-paper"
              />
            </div>
          </div>

          {/* device */}
          <div className="relative z-10 w-full max-w-3xl" style={{ perspective: '1200px' }}>
            {/* ── the device frame ── */}
            <motion.div
              style={{ rotateX, scale: frameScale, y: frameY, transformStyle: 'preserve-3d' }}
              className="relative"
            >
              <div className="rounded-[1.6rem] border border-white/14 bg-gradient-to-b from-[#2c2c2c] to-[#121212] p-[9px] shadow-[0_60px_120px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.16)]">
                {/* browser chrome */}
                <div dir="ltr" className="flex items-center gap-3 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/22" />
                    <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
                  </div>
                  <div className="mx-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-4 py-1.5">
                    <Lock className="h-3 w-3 text-smoke" />
                    <span className="text-[11px] tracking-wide text-mist">
                      minassa-dirasa.vercel.app
                    </span>
                  </div>
                  <div className="w-12" />
                </div>

                {/* viewport — the screenshot pans automatically with scroll */}
                <div
                  ref={frameRef}
                  className="relative h-[46vh] overflow-hidden rounded-2xl bg-[#0b0b0b] sm:h-[56vh] md:h-[60vh]"
                >
                  <motion.img
                    ref={imgRef}
                    src={`${import.meta.env.BASE_URL}screenshots/platform-preview-v3.jpg`}
                    alt="لقطة من داخل منصّة دراسة: الجدول الدراسي، مؤقت بومودورو، والمهام"
                    style={{ y: imgY, willChange: 'transform' }}
                    className="block h-auto w-full select-none"
                    draggable={false}
                    onLoad={() => {
                      if (frameRef.current && imgRef.current) {
                        setMaxPan(
                          Math.max(
                            0,
                            imgRef.current.offsetHeight - frameRef.current.clientHeight
                          )
                        );
                      }
                    }}
                  />
                  {/* top & bottom subtle vignettes inside the screen */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/50 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              </div>

              {/* floor shadow */}
              <div className="pointer-events-none absolute -bottom-10 left-1/2 h-10 w-[80%] -translate-x-1/2 rounded-[100%] bg-black/60 blur-2xl" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA under the tour */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 pb-24 pt-6 text-center md:pb-32"
      >
        <p className="leading-loose text-smoke">
          ما شاهدته هنا لمحة موجزة لا أكثر. خلف هذه الشاشة تفاصيل لا تنقلها
          الصور: وضع التركيز المطلق، ومتابعة المعدل، وتنبيهات الفروض، وأشياء
          أخرى تركناها لتكتشفها بنفسك.
        </p>
        <a
          href={PLATFORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-solid group flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-base font-semibold text-ink"
        >
          <GraduationCap className="h-5 w-5" strokeWidth={1.8} />
          افتح المنصة واستكشف البقية
          <ArrowUpLeft className="h-4 w-4 opacity-60 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        <p className="text-xs text-white/35">مجانية · تعمل من المتصفح مباشرة · من دون تثبيت</p>
      </motion.div>
    </section>
  );
}
