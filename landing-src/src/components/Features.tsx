import { motion } from 'framer-motion';
import {
  CalendarDays,
  Timer,
  CheckCircle2,
  NotebookPen,
  BarChart3,
  CalendarClock,
  Link2,
} from 'lucide-react';
import SectionHeading from './SectionHeading';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const features = [
  {
    icon: CalendarDays,
    title: 'جدول دراسي مخصص',
    desc: 'رتّب موادك وأوقات دراستك كما يناسبك أنت، لا كما يفرضه قالب جاهز. عدّل الجدول متى شئت، وخلّ أسبوعك واضحًا أمامك من أول نظرة.',
    span: 'lg:col-span-7',
  },
  {
    icon: Timer,
    title: 'مؤقت بومودورو ووضع التركيز',
    desc: 'جلسات دراسة مركّزة تليها فترات راحة قصيرة. طريقة بسيطة، لكنها تغيّر شكل يومك الدراسي فعلًا.',
    span: 'lg:col-span-5',
  },
  {
    icon: CheckCircle2,
    title: 'إدارة المهام والتقدم',
    desc: 'أضف ما عليك إنجازه اليوم، واشطب المهام واحدة تلو الأخرى. الشعور بالتقدم وحده يستحق.',
    span: 'lg:col-span-4',
  },
  {
    icon: NotebookPen,
    title: 'تدوين الملاحظات',
    desc: 'فكرة خطرت لك أثناء المراجعة؟ دوّنها فورًا قبل أن تضيع، وارجع إليها وقت ما تحتاجها.',
    span: 'lg:col-span-4',
  },
  {
    icon: BarChart3,
    title: 'متابعة العلامات والمعدل',
    desc: 'سجّل علاماتك أولًا بأول وراقب معدلك. الأرقام أوضح مؤشر على مستواك الحقيقي.',
    span: 'lg:col-span-4',
  },
  {
    icon: CalendarClock,
    title: 'المواعيد والاختبارات القادمة',
    desc: 'عدّ تنازلي لكل اختبار قادم، حتى لا تتفاجأ بموعد نسيته. تعرف بالضبط كم بقي لك من وقت.',
    span: 'lg:col-span-5',
  },
  {
    icon: Link2,
    title: 'مكتبة الروابط والمصادر',
    desc: 'قناة الأستاذ، ملف التلخيص، فيديو الشرح. كل الروابط التي تعود إليها باستمرار، محفوظة في مكان واحد يسهل الرجوع إليه.',
    span: 'lg:col-span-7',
  },
];

export default function Features() {
  return (
    <section id="features" className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          index="01"
          label="الأدوات"
          title="أدواتك الدراسية، مرتّبة في مساحة واحدة"
          subtitle="لست بحاجة إلى خمسة تطبيقات لتنظّم يومك الدراسي. كل أداة هنا بُنيت لتكمل الأخرى، وتشتغل معك من أول لحظة."
        />

        <div className="mt-12 grid gap-4 sm:mt-14 md:grid-cols-2 lg:grid-cols-12">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.1, ease: EASE }}
              className={`panel group relative rounded-2xl p-6 transition-colors duration-400 hover:border-white/22 hover:bg-white/[0.05] sm:p-7 ${f.span}`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 text-mist transition-colors duration-400 group-hover:border-white/30 group-hover:text-white">
                  <f.icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <span
                  dir="ltr"
                  className="text-[11px] tracking-[0.3em] text-white/20 transition-colors duration-400 group-hover:text-white/40"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-5 text-base font-semibold text-white sm:text-lg">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-smoke transition-colors duration-400 group-hover:text-mist">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
