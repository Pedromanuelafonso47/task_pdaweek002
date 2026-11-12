import Image from 'next/image';
import { PHOTOS, type PhotoKey } from '@/content/photos';
import { cn } from '@/lib/utils';

/**
 * Fotografia real com licença livre. Mostra sempre o crédito (exigido por CC BY / CC BY-SA).
 * `credit="overlay"` coloca o crédito discreto sobre a imagem; `"below"` por baixo; `"none"` só quando
 * o crédito aparece noutro ponto visível da mesma secção.
 */
export function Photo({
  k,
  className,
  imgClassName,
  sizes = '100vw',
  priority,
  credit = 'overlay',
  caption,
  fill = true,
}: {
  k: PhotoKey;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  credit?: 'overlay' | 'below' | 'none';
  caption?: boolean;
  fill?: boolean;
}) {
  const p = PHOTOS[k];
  const creditText = <PhotoCredit k={k} />;
  return (
    <figure className={cn('relative overflow-hidden', className)}>
      {fill ? (
        <Image src={p.src} alt={p.alt} fill sizes={sizes} priority={priority} placeholder="blur" blurDataURL={p.blurDataURL} className={cn('object-cover', imgClassName)} />
      ) : (
        <Image src={p.src} alt={p.alt} width={p.width} height={p.height} sizes={sizes} priority={priority} placeholder="blur" blurDataURL={p.blurDataURL} className={cn('h-auto w-full', imgClassName)} />
      )}
      {credit === 'overlay' && (
        <figcaption className="absolute bottom-0 right-0 z-[1] max-w-[85%] truncate rounded-tl-md bg-black/45 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
          {caption ? `${p.alt} · ` : ''}
          {creditText}
        </figcaption>
      )}
      {credit === 'below' && (
        <figcaption className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {caption && <span className="text-foreground/80">{p.alt}. </span>}
          {creditText}
        </figcaption>
      )}
    </figure>
  );
}

export function PhotoCredit({ k }: { k: PhotoKey }) {
  const p = PHOTOS[k];
  return (
    <>
      Foto:{' '}
      <a href={p.source} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
        {p.author}
      </a>
      {' · '}
      {p.licenseUrl ? (
        <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {p.license}
        </a>
      ) : (
        p.license
      )}
    </>
  );
}
