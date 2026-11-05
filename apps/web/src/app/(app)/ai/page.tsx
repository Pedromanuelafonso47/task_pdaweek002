'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Info, Lock, MapPinned, MessageSquarePlus, Send, Sparkles, User } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Notice, PageLoader, Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Markdown } from '@/features/ai/markdown';
import { api } from '@/lib/api';
import { useFarm } from '@/lib/farm-context';
import { cn, fmtRelative } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine: 'LLM' | 'RULES' | null;
  createdAt: string;
  pending?: boolean;
}
interface ConversationSummary {
  id: string;
  title: string;
  farmId: string | null;
  createdAt: string;
}

const SUGGESTIONS = [
  'Qual é a melhor automação para a minha propriedade?',
  'Como posso reduzir o consumo de água?',
  'Que sensores devo instalar?',
  'Como posso melhorar a produtividade?',
  'Qual é a melhor tecnologia para a minha cultura?',
  'Quanto custaria automatizar a irrigação?',
];

export default function AiPage() {
  const { farm, farmId, isLoading: farmsLoading } = useFarm();
  const qc = useQueryClient();
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const endRef = React.useRef<HTMLDivElement>(null);

  const status = useQuery({ queryKey: ['ai', 'status'], queryFn: () => api<{ mode: 'LLM' | 'RULES' }>('/ai/status'), staleTime: 300_000 });
  const conversations = useQuery({
    queryKey: ['ai', 'conversations', farmId],
    queryFn: () => api<ConversationSummary[]>(`/ai/conversations?farmId=${farmId}`),
    enabled: !!farmId,
  });
  const loadConv = useMutation({
    mutationFn: (id: string) => api<{ id: string; messages: Msg[] }>(`/ai/conversations/${id}`),
    onSuccess: (c) => {
      setConversationId(c.id);
      setMessages(c.messages);
    },
  });

  // Ao mudar de propriedade, começa uma conversa nova (a IA só vê a propriedade ativa)
  React.useEffect(() => {
    setConversationId(null);
    setMessages([]);
  }, [farmId]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const ask = useMutation({
    mutationFn: (message: string) =>
      api<{ conversationId: string; message: Msg }>('/ai/ask', { method: 'POST', body: { message, farmId: farmId ?? undefined, conversationId: conversationId ?? undefined } }),
    onMutate: (message) => {
      setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: message, engine: null, createdAt: new Date().toISOString(), pending: true }]);
    },
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setMessages((m) => [...m.map((x) => ({ ...x, pending: false })), r.message]);
      qc.invalidateQueries({ queryKey: ['ai', 'conversations'] });
    },
    onError: () => {
      setMessages((m) => m.filter((x) => !x.pending));
    },
  });

  const send = (text: string) => {
    const t = text.trim();
    if (t.length < 2 || ask.isPending) return;
    setInput('');
    ask.mutate(t);
  };

  if (farmsLoading) return <PageLoader />;
  if (!farmId || !farm) {
    return (
      <EmptyState
        icon={MapPinned}
        title="Sem propriedade ativa"
        description="O Agro AI responde com base nos dados da tua propriedade. Regista uma para começar."
        action={
          <Button asChild>
            <Link href="/farms/new">Registar propriedade</Link>
          </Button>
        }
      />
    );
  }

  const mode = status.data?.mode;

  return (
    <div>
      <PageHeader
        eyebrow="Agro AI"
        title="Assistente agrícola"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Vê apenas os dados autorizados de <b className="text-foreground">{farm.name}</b>. Não inventa leituras, diagnósticos nem preços.
          </span>
        }
        actions={
          <>
            {mode && (
              <Badge tone={mode === 'LLM' ? 'green' : 'amber'}>
                {mode === 'LLM' ? <Sparkles /> : <Info />} {mode === 'LLM' ? 'IA generativa' : 'Modo baseado em regras'}
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setConversationId(null);
                setMessages([]);
              }}
            >
              <MessageSquarePlus /> Nova conversa
            </Button>
          </>
        }
      />

      {mode === 'RULES' && (
        <Notice tone="warn" className="mb-4">
          A IA generativa não está configurada no servidor (ANTHROPIC_API_KEY). As respostas são construídas a partir dos dados da propriedade e do motor de recomendações, sem IA generativa: são fiáveis, mas menos flexíveis para perguntas abertas.
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="order-2 lg:order-1">
          <Card className="p-2">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Conversas desta propriedade</div>
            {conversations.isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            ) : conversations.error ? (
              <div className="p-2">
                <ErrorState error={conversations.error} retry={() => conversations.refetch()} />
              </div>
            ) : !conversations.data?.length ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Ainda sem conversas.</p>
            ) : (
              <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
                {conversations.data.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => loadConv.mutate(c.id)}
                      className={cn('w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60', c.id === conversationId && 'bg-primary/10')}
                    >
                      <span className="line-clamp-1">{c.title}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtRelative(c.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>

        <Card className="order-1 flex min-h-[60vh] flex-col lg:order-2">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {loadConv.isPending && <Skeleton className="h-24" />}
            {!messages.length && !loadConv.isPending && (
              <div className="mx-auto max-w-xl py-6 text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-6" />
                </div>
                <p className="font-display text-lg font-semibold">Pergunta sobre a tua propriedade</p>
                <p className="mb-5 text-sm text-muted-foreground">
                  As respostas consideram localização, culturas, solo, água, infraestrutura, orçamento e histórico registados. Quando faltam dados, o assistente pede-os.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-md border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('grid size-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary')}>
                  {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
                </div>
                <div className={cn('max-w-[85%] rounded-lg px-4 py-3', m.role === 'user' ? 'bg-primary/10' : 'border bg-background/50', m.pending && 'opacity-70')}>
                  {m.role === 'assistant' ? <Markdown text={m.content} /> : <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                  {m.role === 'assistant' && m.engine && (
                    <div className="mt-2 text-[11px] text-muted-foreground">{m.engine === 'LLM' ? 'Resposta gerada por IA com os dados da propriedade' : 'Resposta baseada em regras e no motor de recomendações'}</div>
                  )}
                </div>
              </div>
            ))}
            {ask.isPending && (
              <div className="flex gap-3">
                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </div>
                <div className="flex items-center gap-1 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                  A analisar a propriedade
                  <span className="inline-flex gap-0.5">
                    <span className="size-1 animate-bounce rounded-full bg-current" />
                    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="flex items-end gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Escreve a tua pergunta… (Enter para enviar, Shift+Enter para nova linha)"
              className="max-h-40 min-h-11 resize-none"
              maxLength={2000}
              aria-label="Pergunta"
            />
            <Button type="submit" size="icon" className="size-11 shrink-0" loading={ask.isPending} disabled={input.trim().length < 2} aria-label="Enviar">
              {!ask.isPending && <Send />}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
