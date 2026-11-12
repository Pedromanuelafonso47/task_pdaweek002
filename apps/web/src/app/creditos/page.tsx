import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/brand';
import { Photo, PhotoCredit } from '@/components/photo';
import { GLOBE_TEXTURES } from '@/content/globe-textures';
import { PHOTOS, type PhotoKey } from '@/content/photos';

export const metadata: Metadata = { title: 'Créditos das fotografias' };

export default function Creditos() {
  const keys = Object.keys(PHOTOS) as PhotoKey[];
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Créditos das fotografias</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Todas as fotografias são reais, publicadas com licença livre no Wikimedia Commons, e usadas de acordo com essas licenças. As imagens de
          projetos mostram sistemas semelhantes em uso, não instalações AGROGENIUS.
        </p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {keys.map((k) => (
            <li key={k} className="overflow-hidden rounded-lg border bg-card">
              <Photo k={k} sizes="(min-width:1024px) 33vw, 100vw" className="aspect-[3/2]" credit="none" />
              <div className="space-y-1 p-3 text-xs">
                <p className="text-sm font-medium">{PHOTOS[k].alt}</p>
                <p className="text-muted-foreground">
                  <PhotoCredit k={k} />
                </p>
              </div>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-tight">Texturas do globo 3D</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          O globo da página inicial usa imagens de satélite da NASA, em domínio público. As nuvens são geradas no navegador e não
          representam o tempo real.
        </p>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {GLOBE_TEXTURES.map((t) => (
            <li key={t.key} className="overflow-hidden rounded-lg border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.src} alt={t.title} loading="lazy" className="aspect-[2/1] w-full object-cover" />
              <div className="space-y-1 p-3 text-xs">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-muted-foreground">
                  {t.author} ·{' '}
                  <a href={t.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {t.license}, Wikimedia Commons
                  </a>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
