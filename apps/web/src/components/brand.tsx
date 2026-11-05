import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#123D2A" />
        <path d="M32 50c0-14 6-24 18-28-2 14-8 22-18 28Z" fill="#27C77B" />
        <path d="M32 50c0-11-5-19-15-22 1 11 6 18 15 22Z" fill="#B7F3D0" />
        <circle cx="32" cy="16" r="3" fill="#B7F3D0" />
        <path d="M32 19v31" stroke="#B7F3D0" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="font-display text-[15px] font-bold tracking-[0.08em]">
          AGRO<span className="text-primary">GENIUS</span>
        </span>
      )}
    </span>
  );
}
