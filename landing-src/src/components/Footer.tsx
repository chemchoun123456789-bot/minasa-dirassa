import { Send, GraduationCap } from 'lucide-react';
import { TELEGRAM_URL, PLATFORM_URL, DEV_MOHAMED, DEV_AHMED } from '../lib/constants';

export default function Footer() {
  return (
    <footer className="px-5 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <a
          href={PLATFORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15">
            <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} />
          </span>
          <span className="text-lg font-semibold">
            منصّة <span className="font-light text-smoke">دراسة</span>
          </span>
        </a>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-smoke">
          <a href="#features" className="transition-colors hover:text-white">
            الأدوات
          </a>
          <a href="#about" className="transition-colors hover:text-white">
            عن المنصة
          </a>
          <a
            href={DEV_MOHAMED}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            Mohamed
          </a>
          <a
            href={DEV_AHMED}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            Ahmed
          </a>
        </div>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="panel flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm text-mist transition-colors duration-300 hover:border-white/30 hover:text-white"
        >
          <Send className="h-4 w-4" />
          قناة تلغرام
        </a>
      </div>

      <p className="mt-10 text-center text-xs text-white/30">
        منصّة دراسة {new Date().getFullYear()} · عمل شخصي من تطوير محمد وأحمد
      </p>
    </footer>
  );
}
