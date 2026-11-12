import Link from 'next/link';
import { Logo } from '@/components/brand';
import { Photo, PhotoCredit } from '@/components/photo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="dark relative isolate hidden overflow-hidden text-snow lg:block">
        <Photo k="angola-colheita-batata" priority sizes="55vw" className="absolute inset-0 -z-10" credit="none" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/55 to-night/30" />
        <div className="flex h-full flex-col justify-between p-10">
          <Link href="/">
            <Logo />
          </Link>
          <div className="max-w-md space-y-5">
            <p className="font-display text-4xl font-semibold leading-tight">Cada lavra é diferente. As recomendações também.</p>
            <ul className="space-y-2.5 text-sm text-snow/85">
              <li>• Projetos dimensionados para a tua área, cultura, água e orçamento em Kz.</li>
              <li>• Rega automática que funciona mesmo sem internet.</li>
              <li>• A bomba nunca trabalha em seco.</li>
            </ul>
            <p className="text-[11px] text-snow/55">
              Agricultoras com a colheita de batata, Angola · <PhotoCredit k="angola-colheita-batata" />
            </p>
          </div>
        </div>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
