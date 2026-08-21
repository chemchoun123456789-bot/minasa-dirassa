const items = [
  'جدول دراسي مخصص',
  'مؤقت بومودورو',
  'وضع التركيز',
  'إدارة المهام',
  'تدوين الملاحظات',
  'متابعة العلامات والمعدل',
  'عد تنازلي للاختبارات',
  'مكتبة الروابط والمصادر',
];

export default function Marquee() {
  const row = [...items, ...items];
  return (
    <div
      dir="ltr"
      className="relative overflow-hidden border-y border-white/8 py-4"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent sm:w-24" />
      <div className="animate-marquee flex w-max items-center gap-8">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-8 whitespace-nowrap">
            <span className="text-sm font-light text-white/45">{item}</span>
            <span className="text-white/20">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
