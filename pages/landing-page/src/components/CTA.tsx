import { motion } from 'framer-motion';
import { Send, Clock3, WalletMinimal, RefreshCcw, GraduationCap, ArrowUpLeft } from 'lucide-react';
import { TELEGRAM_URL, PLATFORM_URL } from '../lib/constants';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const points = [
  { icon: WalletMinimal, text: 'مجانية بالكامل، بلا اشتراك وبلا إعلانات' },
  { icon: Clock3, text: 'تبدأ خلال دقيقة، من أي جهاز' },
  { icon: RefreshCcw, text: 'تحديثات مستمرة بناءً على ملاحظات الطلاب' },
];

export default function CTA() {
  return (
    <section
      id="join"
      className="grid-bg relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28"
    >
      {/* drifting monochrome light behind the glass */}
      <div className="blob-a pointer-events-none absolute right-[12%] top-[15%] h-72 w-72 rounded-full bg-white/[0.07] blur-[110px]" />
      <div className="blob-b pointer-events-none absolute bottom-[8%] left-[10%] h-80 w-80 rounded-full bg-white/[0.05] blur-[130px]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, #070707 92%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* section index */}
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
              03
            </span>
            <span className="text-xs font-medium tracking-wide text-mist">انضم إلينا</span>
          </span>
          <span className="h-px max-w-40 flex-1 bg-gradient-to-l from-white/20 to-transparent" />
        </motion.div>

        {/* the glass panel */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: EASE }}
          className="liquid-glass mt-8 rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16 lg:px-16"
        >
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            {/* copy */}
            <div>
              <motion.h2
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                className="text-3xl font-bold leading-[1.3] tracking-tight sm:text-5xl"
              >
                مكانك الدراسي الجديد
                <br />
                <span className="font-light text-mist">جاهز، وينتظرك.</span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.22, ease: EASE }}
                className="mt-5 max-w-lg leading-loose text-smoke"
              >
                كل ما تحتاجه لتنظيم يومك الدراسي صار في مكان واحد. انضم إلى قناة
                المنصة على تلغرام، وكن من أوائل من يجرّب كل ميزة جديدة قبل الجميع.
              </motion.p>

              {/* trust points as glass chips */}
              <motion.ul
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.34, ease: EASE }}
                className="mt-8 space-y-3"
              >
                {points.map((p) => (
                  <li key={p.text} className="flex items-center gap-3.5">
                    <span className="glass-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      <p.icon className="h-4 w-4 text-mist" strokeWidth={1.6} />
                    </span>
                    <span className="text-sm leading-relaxed text-mist">{p.text}</span>
                  </li>
                ))}
              </motion.ul>
            </div>

            {/* action card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
              className="glass-chip rounded-3xl p-7 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="glass-chip flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Send className="h-5 w-5 text-white" strokeWidth={1.5} />
                </span>
                <div>
                  <div className="font-semibold text-white">قناة المنصة على تلغرام</div>
                  <div dir="ltr" className="mt-0.5 text-right text-xs tracking-wide text-smoke">
                    t.me/Minassa_Dirasa
                  </div>
                </div>
              </div>

              <p className="mt-5 text-sm leading-loose text-smoke">
                هناك ننشر كل جديد: الميزات القادمة، التحديثات، ونصائح تنظيم
                الدراسة. خطوتك الأولى تبدأ من هنا.
              </p>

              <a
                href={PLATFORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-solid group mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-semibold text-ink"
              >
                <GraduationCap className="h-5 w-5" strokeWidth={1.8} />
                افتح منصّة دراسة الآن
                <ArrowUpLeft className="h-4 w-4 opacity-60 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>

              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-liquid group mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-mist hover:text-white"
              >
                <Send className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                انضم إلى قناة تلغرام
              </a>

              <p className="mt-5 text-center text-xs text-white/35">
                الانضمام مجاني، والخروج بضغطة زر. لا شيء تخسره.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
