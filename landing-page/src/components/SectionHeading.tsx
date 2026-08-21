import { motion } from 'framer-motion';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function SectionHeading({
  index,
  label,
  title,
  subtitle,
  dark = true,
}: {
  index: string;
  label: string;
  title: string;
  subtitle?: string;
  dark?: boolean;
}) {
  const sub = dark ? 'text-smoke' : 'text-black/60';

  return (
    <div className="text-right">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex items-center gap-4"
      >
        <span
          className={`inline-flex items-center gap-3 rounded-full py-1.5 pl-4 pr-1.5 ${
            dark
              ? 'border border-white/12 bg-white/[0.04]'
              : 'border border-black/12 bg-black/[0.04]'
          }`}
        >
          <span
            dir="ltr"
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
              dark ? 'bg-paper text-ink' : 'bg-ink text-paper'
            }`}
          >
            {index}
          </span>
          <span
            className={`text-xs font-medium tracking-wide ${
              dark ? 'text-mist' : 'text-black/70'
            }`}
          >
            {label}
          </span>
        </span>
        <span
          className={`h-px flex-1 max-w-40 bg-gradient-to-l ${
            dark ? 'from-white/20' : 'from-black/20'
          } to-transparent`}
        />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
        className="mt-6 max-w-2xl text-[1.7rem] font-bold leading-snug tracking-tight sm:text-4xl"
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className={`mt-4 max-w-xl leading-loose ${sub}`}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
