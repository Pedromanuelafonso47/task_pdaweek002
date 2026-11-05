import Link from 'next/link';
import { Logo } from '@/components/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-deep lg:block">
        <div className="bg-field-grid absolute inset-0 opacity-60" />
        <div className="absolute -right-32 -top-32 size-[520px] rounded-full bg-tech/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[420px] rounded-full bg-mint/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-10 text-snow">
          <Link href="/">
            <Logo />
          </Link>
          <div className="max-w-md space-y-5">
            <p className="font-display text-3xl font-semibold leading-tight">Cada propriedade é diferente. As recomendações também.</p>
            <ul className="space-y-3 text-sm text-mint/80">
              <li>• Projetos IoT dimensionados para a tua área, cultura, água e orçamento em Kz.</li>
              <li>• Rega automática que funciona mesmo sem internet.</li>
              <li>• Comandos à bomba sempre validados: nunca funciona a seco.</li>
            </ul>
          </div>
          <p className="text-xs text-mint/50">Pensado para Angola. Preparado para África.</p>
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
