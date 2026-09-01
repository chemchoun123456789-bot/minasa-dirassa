import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, BookOpenText, ShieldCheck, MessageCircleQuestion } from 'lucide-react';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const GUIDE_URL = 'https://minassa-dirasa.vercel.app/pages/guide';
const PRIVACY_URL =
  'https://minassa-dirasa.vercel.app/Pages/privacy';

type Faq = { q: string; a: string };

const faqs: Faq[] = [
  {
    q: 'كيف أنشئ حسابًا في المنصة؟',
    a: 'اكتب اسمك واسم مؤسستك وبريدك الإلكتروني، ثم عيّن كلمة مرور خاصة بالمنصة وحدها، فلا صلة لها بحساب Google أو أي جهة أخرى. بعد ذلك يصلك رمز تحقق من ستة أرقام على بريدك لتأكيده، وتنتقل مباشرة إلى لوحة التحكم. وإن لم تجد الرسالة في صندوق الوارد فابحث عنها في مجلد البريد غير المرغوب.',
  },
  {
    q: 'هل المنصة مجانية حقًا؟',
    a: 'نعم، ومن دون شروط خفية. المنصة عمل شخصي بدأ من حاجتنا إليه أيام الدراسة، ثم قررنا فتحه لكل طالب. الأدوات السبع كلها متاحة مجانًا، ولا يوجد في الموقع إعلان واحد، ولا ننوي إضافة إعلانات مستقبلًا.',
  },
  {
    q: 'ما الذي يميز مؤقت بومودورو في المنصة؟',
    a: 'الفكرة الأساسية معروفة: خمس وعشرون دقيقة من التركيز تليها استراحة قصيرة. ما أضفناه هو حرية التخصيص؛ عدّل مدد الجلسات والاستراحات كما يناسبك، واختر صوت التنبيه الذي يريحك. وعند تفعيل وضع التركيز المطلق تختفي عناصر الصفحة كلها ويبقى المؤقت وحده أمامك في شاشة كاملة.',
  },
  {
    q: 'هل يمكنني تصدير جدولي أو طباعته؟',
    a: 'يمكنك تصدير الجدول صورةً بصيغة PNG بوضعين على اختيارك: مظلم أو ساطع. ويمكنك أيضًا طباعته مباشرة باختيار أحد ثلاثة تخطيطات: عمودي صغير، أو عموديان جنبًا إلى جنب، أو أفقي كبير. وأي تعديل تجريه على الجدول يُحفظ فور إجرائه.',
  },
  {
    q: 'كيف تساعدني المنصة على تذكّر مواعيد الفروض؟',
    a: 'عند إضافة فرض بتاريخه يبدأ عداد تنازلي يعرض عدد الأيام المتبقية. تتصدر المواعيد الأقرب القائمة، وتنتقل المواعيد المنقضية إلى قائمة منفصلة. وإذا سمحت للمنصة بإرسال الإشعارات من متصفحك، وصلك تنبيه قبل الموعد بيوم.',
  },
  {
    q: 'ما البيانات التي تجمعها المنصة عني؟',
    a: 'ثلاثة أشياء لا غير: الاسم، والبريد الإلكتروني لأن تسجيل الدخول يتم برمز يُرسل إليه، واسم المؤسسة. أما الجدول والمهام والملاحظات والعلامات فتبقى في حسابك وحدك؛ لا تُقرأ ولا تُحلل ولا تُستغل في أي غرض.',
  },
  {
    q: 'أين تُخزَّن بياناتي؟ ومن يستطيع الاطلاع عليها؟',
    a: 'تُخزَّن على خوادم Supabase الحاصلة على اعتماد SOC 2، مشفّرةً أثناء النقل وفي التخزين. كل حساب معزول عن سواه، ولا يطّلع أحد على محتواه، بمن في ذلك فريق المنصة. أما كلمة مرورك فخاصة بالمنصة وحدها ولا تُستخدم في أي خدمة أخرى، وتُحفظ مشفّرة بصيغة لا يمكن لأحد قراءتها.',
  },
  {
    q: 'هل تُشارك بياناتي مع أي جهة خارجية؟',
    a: 'لا. لا بيع ولا تأجير ولا مشاركة مع معلنين أو شركات تحليل، والموقع خالٍ من الإعلانات أساسًا. الاستثناء الوحيد هو الاستجابة لطلب قانوني رسمي ملزم، وهو أمر منصوص عليه صراحةً في سياسة الخصوصية.',
  },
  {
    q: 'هل يُحذف حسابي نهائيًا إذا طلبت ذلك؟',
    a: 'نعم. أرسل طلب الحذف إلى بريد المنصة الرسمي، فيُحذف اسمك وبريدك وملفك الدراسي كاملًا. ولك قبل ذلك أن تطلب نسخة من بياناتك بصيغة JSON تحتفظ بها لديك.',
  },
];

function FaqItem({
  faq,
  index,
  open,
  onToggle,
}: {
  faq: Faq;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.07, ease: EASE }}
      className={`panel overflow-hidden rounded-2xl transition-colors duration-300 ${
        open ? 'border-white/22 bg-white/[0.05]' : 'hover:border-white/16'
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4.5 text-right sm:px-6 sm:py-5"
      >
        {/* number */}
        <span
          dir="ltr"
          className={`hidden shrink-0 text-[11px] tracking-[0.25em] transition-colors duration-300 sm:block ${
            open ? 'text-white/55' : 'text-white/25'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm font-semibold leading-relaxed transition-colors duration-300 sm:text-base ${
              open ? 'text-white' : 'text-white/80'
            }`}
          >
            {faq.q}
          </span>
        </span>

        {/* plus / cross */}
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            open
              ? 'rotate-45 border-white/30 bg-paper text-ink'
              : 'border-white/15 text-white/50'
          }`}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="border-r-2 border-white/15 pr-4 sm:mr-9">
                <p className="text-sm leading-loose text-smoke">{faq.a}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative overflow-hidden border-t border-white/8 px-5 py-20 sm:px-6 sm:py-28"
    >
      {/* grid backdrop, faded softly at the edges — sits behind the content */}
      <div
        className="grid-bg pointer-events-none absolute inset-0 opacity-55"
        style={{
          maskImage:
            'radial-gradient(ellipse 85% 80% at 50% 35%, black 25%, transparent 92%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 80% at 50% 35%, black 25%, transparent 92%)',
        }}
      />

      <div className="relative mx-auto max-w-4xl">
        {/* badge */}
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
              05
            </span>
            <span className="text-xs font-medium tracking-wide text-mist">الأسئلة الشائعة</span>
          </span>
          <span className="h-px max-w-40 flex-1 bg-gradient-to-l from-white/20 to-transparent" />
        </motion.div>

        {/* heading */}
        <motion.h2
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mt-6 text-[1.7rem] font-bold leading-snug tracking-tight sm:text-4xl"
        >
          أكثر ما يسأل عنه
          <span className="font-light text-smoke"> الطلاب</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mt-4 max-w-xl leading-loose text-smoke"
        >
          إجابات موجزة عن أكثر الأسئلة ورودًا، من إنشاء الحساب إلى حماية البيانات.
          وما لم تجده هنا ستجده في الدليل الرسمي.
        </motion.p>

        {/* items */}
        <div className="mt-10 space-y-3 sm:mt-12">
          {faqs.map((faq, i) => (
            <FaqItem
              key={faq.q}
              faq={faq}
              index={i}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* footer links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="panel mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl px-6 py-5 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04]">
              <MessageCircleQuestion className="h-4.5 w-4.5 text-mist" strokeWidth={1.6} />
            </span>
            <p className="text-sm leading-relaxed text-smoke">
              لم تجد إجابتك؟ الدليل الرسمي يشرح كل أداة خطوة بخطوة.
            </p>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <a
              href={GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-liquid flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-mist hover:text-white"
            >
              <BookOpenText className="h-3.5 w-3.5" />
              دليل الاستخدام
            </a>
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-liquid flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-mist hover:text-white"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              سياسة الخصوصية
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
