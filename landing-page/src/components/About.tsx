import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import SectionHeading from './SectionHeading';
import { DEV_MOHAMED, DEV_AHMED } from '../lib/constants';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const devs = [
  { name: 'Mohamed', role: 'تطوير وتصميم', handle: '@bxlt3_m', url: DEV_MOHAMED },
  { name: 'Ahmed', role: 'تطوير وفكرة', handle: '@elysiqn_xq', url: DEV_AHMED },
];

export default function About() {
  return (
    <section id="about" className="relative overflow-hidden border-t border-white/8 px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading index="02" label="عن المنصة" title="من طلاب، إلى طلاب" />

        <div className="mt-12 grid gap-10 sm:mt-14 lg:grid-cols-5 lg:gap-14">
          {/* story */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, ease: EASE }}
            className="lg:col-span-3"
          >
            <p className="text-lg leading-loose text-mist sm:text-xl">
              بدأت الفكرة من مشكلة نعيشها كل يوم: مهام كثيرة، وقت ضيق، وكل شيء
              مشتّت بين تطبيق وملف ودفتر.
            </p>
            <p className="mt-6 leading-loose text-smoke">
              فقررنا نبني المكان الذي كنا نتمنى وجوده ونحن ندرس. مساحة واحدة تجمع
              الجدول والمهام والملاحظات والعلامات، بواجهة بسيطة لا تشتّتك أكثر.
              منصّة دراسة عمل شخصي، بلا شركة خلفه ولا إعلانات، فقط رغبة في أن
              تكون دراسة الطالب العربي أسهل مما كانت علينا.
            </p>
            <p className="mt-6 leading-loose text-smoke">
              المنصة ما زالت في بدايتها، ونطوّرها باستمرار. كل ملاحظة تصلنا من
              الطلاب تدخل في نسخة قادمة، بإذن الله.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {['منصة_دراسة', 'تنظيم_الوقت', 'بومودورو', 'التركيز'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-smoke"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </motion.div>

          {/* devs */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
            className="lg:col-span-2"
          >
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-white/20" />
              <h3 className="text-sm font-light text-white/50">من يقف خلف المنصة</h3>
            </div>

            <div className="mt-6 space-y-3">
              {devs.map((d) => (
                <a
                  key={d.name}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="panel group flex items-center justify-between rounded-2xl px-5 py-4 transition-colors duration-300 hover:border-white/25 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-sm font-semibold">
                      {d.name[0]}
                    </span>
                    <div>
                      <div className="font-semibold text-white">{d.name}</div>
                      <div className="mt-0.5 text-xs text-smoke">
                        {d.role} · <span dir="ltr">{d.handle}</span>
                      </div>
                    </div>
                  </div>
                  <Send className="h-4 w-4 shrink-0 text-smoke transition-all duration-300 group-hover:-translate-x-1 group-hover:text-white" />
                </a>
              ))}
            </div>

            <p className="mt-8 border-t border-white/8 pt-6 text-sm leading-loose text-smoke">
              هدفنا بسيط: طالب عربي أكثر تنظيمًا وتركيزًا، خطوة بخطوة. إذا استفدت
              من المنصة، شاركها مع زميل يحتاجها.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
