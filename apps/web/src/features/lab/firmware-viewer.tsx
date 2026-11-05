'use client';
import { Check, Copy, Download } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const KEYWORDS =
  /\b(const|void|int|float|bool|uint8_t|uint16_t|uint32_t|long|char|struct|return|if|else|for|while|break|continue|true|false|static|String|auto|nullptr)\b/g;

/** Destaque de sintaxe simples (comentários, strings, diretivas, palavras-chave, números). */
function highlight(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const comment = line.indexOf('//');
  const code = comment >= 0 ? line.slice(0, comment) : line;
  const rest = comment >= 0 ? line.slice(comment) : '';
  if (/^\s*#/.test(code)) {
    out.push(<span key="d" className="text-sky-500">{code}</span>);
  } else {
    const parts = code.split(/("(?:[^"\\]|\\.)*")/g);
    parts.forEach((p, i) => {
      if (p.startsWith('"')) out.push(<span key={i} className="text-amber-500">{p}</span>);
      else {
        const sub = p.split(KEYWORDS);
        sub.forEach((s, j) => {
          if (j % 2 === 1) out.push(<span key={`${i}-${j}`} className="text-primary">{s}</span>);
          else
            out.push(
              ...s.split(/(\b\d+(?:\.\d+)?(?:UL|U|L)?\b)/g).map((t, k) =>
                k % 2 === 1 ? <span key={`${i}-${j}-${k}`} className="text-violet-500 dark:text-violet-400">{t}</span> : t,
              ),
            );
        });
      }
    });
  }
  if (rest) out.push(<span key="c" className="text-muted-foreground/70 italic">{rest}</span>);
  return out;
}

export function FirmwareViewer({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = React.useState(false);
  const lines = React.useMemo(() => code.split('\n'), [code]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">{filename} · {lines.length} linhas</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check /> : <Copy />} {copied ? 'Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={save}>
            <Download /> .ino
          </Button>
        </div>
      </div>
      <pre className="max-h-[560px] overflow-auto bg-background/60 py-3 font-mono text-[12px] leading-5">
        {lines.map((l, i) => (
          <div key={i} className="flex">
            <span className="w-12 shrink-0 select-none pr-3 text-right text-muted-foreground/50">{i + 1}</span>
            <code className="whitespace-pre pr-4">{highlight(l)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}
