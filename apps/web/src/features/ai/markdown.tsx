import * as React from 'react';

/**
 * Markdown mínimo e seguro: constrói elementos React (sem dangerouslySetInnerHTML).
 * Suporta parágrafos, listas (-, •, *, 1.), **negrito**, *itálico* / _itálico_ e `código`.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k} className="text-muted-foreground">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(
        <p key={k} className="leading-relaxed">
          {para.flatMap((l, i) => (i ? [<br key={`${k}-br${i}`} />, ...inline(l, `${k}-${i}`)] : inline(l, `${k}-${i}`)))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((it, i) => (
        <li key={`${k}-${i}`} className="leading-relaxed">
          {inline(it, `${k}-${i}`)}
        </li>
      ));
      blocks.push(
        list.ordered ? (
          <ol key={k} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={k} className="list-disc space-y-1 pl-5 marker:text-primary">
            {items}
          </ul>
        ),
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*(?:[-•*])\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]);
    } else if (/^\s+\S/.test(raw) && list) {
      // continuação de um item de lista
      list.items[list.items.length - 1] += ` ${line.trim()}`;
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      if (heading) {
        flushPara();
        blocks.push(
          <p key={`h${blocks.length}`} className="font-display font-semibold">
            {inline(heading[1], `h${blocks.length}`)}
          </p>,
        );
      } else para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="space-y-2 text-sm">{blocks}</div>;
}
