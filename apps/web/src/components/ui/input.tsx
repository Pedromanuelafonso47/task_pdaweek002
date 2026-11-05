import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'flex w-full rounded-md border border-input bg-background/60 px-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, 'h-10', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-20 py-2', className)} {...p} />
));
Textarea.displayName = 'Textarea';

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2389958E' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, style, ...p }, ref) => (
  <select
    ref={ref}
    className={cn(base, 'h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9', className)}
    style={{ backgroundImage: chevron, ...style }}
    {...p}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[13px] font-medium text-foreground/90', className)} {...p} />;
}

/** Campo com rótulo, ajuda e mensagem de erro. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Seleção de opções em "chips" (multi ou única). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  labels,
}: {
  options: readonly T[];
  value: T[] | T | undefined;
  onChange: (v: T[] | T) => void;
  multiple?: boolean;
  labels: Record<string, string>;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            aria-pressed={on}
            onClick={() => (multiple ? onChange(on ? selected.filter((x) => x !== o) : [...selected, o]) : onChange(o))}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition-all',
              on ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]' : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
            )}
          >
            {labels[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

/** Interruptor sim/não acessível. */
export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('flex w-full items-center justify-between gap-4 rounded-md border p-3 text-left transition-colors', checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/40')}
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted-foreground/30')}>
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
