'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock, Code2, FlaskConical, GitCompare, Heart, Layers, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { LABELS, formatKz } from '@agrogenius/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { Photo } from '@/components/photo';
import { mediaFor } from '@/content/project-media';
import { CATEGORIES, CATEGORY_ICON, DIFFICULTIES, DifficultyBadge, OfflineBadge } from '@/features/lab/project-meta';
import { api } from '@/lib/api';
import type { ProjectListItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const MAX_COMPARE = 4;

function LabInner() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState(params.get('q') ?? '');
  const [compare, setCompare] = React.useState<string[]>([]);

  const filters = {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    difficulty: params.get('difficulty') ?? '',
    maxCostKz: params.get('maxCostKz') ?? '',
    offline: params.get('offline') === 'true',
    favorites: params.get('favorites') === 'true',
  };

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (search !== filters.q) setParam('q', search.trim() || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v && qs.set(k, String(v)));
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', qs.toString()],
    queryFn: () => api<ProjectListItem[]>(`/projects?${qs.toString()}`),
  });

  const fav = useMutation({
    mutationFn: (slug: string) => api<{ slug: string; isFavorite: boolean }>(`/projects/${slug}/favorite`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(r.isFavorite ? 'Guardado nos favoritos' : 'Removido dos favoritos');
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', r.slug] });
    },
  });

  const toggleCompare = (slug: string) =>
    setCompare((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : c.length >= MAX_COMPARE ? (toast.info(`Máximo de ${MAX_COMPARE} projetos`), c) : [...c, slug]));

  const grouped = CATEGORIES.map((cat) => ({ cat, items: (data ?? []).filter((p) => p.category === cat) })).filter((g) => g.items.length);
  const activeFilters = !!(filters.q || filters.category || filters.difficulty || filters.maxCostKz || filters.offline || filters.favorites);

  return (
    <div className="pb-24">
      <section className="dark relative isolate mb-6 overflow-hidden rounded-2xl text-snow">
        <Photo k="kit-gota-a-gota" priority sizes="(min-width:1024px) 70vw, 100vw" className="absolute inset-0 -z-10" imgClassName="object-[center_60%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/80 to-night/20" />
        <div className="max-w-2xl space-y-2 px-6 py-10 sm:px-10 sm:py-14">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-tech">AgroTech Lab</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Biblioteca de Soluções Inteligentes</h1>
          <p className="text-sm text-snow/75 sm:text-base">
            Projetos que já funcionam no campo — com materiais, esquemas de ligação, código para ESP32, montagem e a animação de cada sistema a
            trabalhar. Custos são preços de referência: confirma com fornecedores locais.
          </p>
        </div>
      </section>

      {/* Categorias */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setParam('category', null)}
          className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm', !filters.category ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground')}
        >
          <Layers className="size-4" /> Todas
        </button>
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c];
          return (
            <button
              key={c}
              onClick={() => setParam('category', filters.category === c ? null : c)}
              className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm', filters.category === c ? 'border-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon className="size-4" /> {LABELS.projectCategory[c]}
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="mb-6 grid gap-2 rounded-lg border bg-card/50 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por nome, componente (ex.: pH, ESP32, bomba)…" className="pl-9" aria-label="Pesquisar projetos" />
        </div>
        <Select value={filters.difficulty} onChange={(e) => setParam('difficulty', e.target.value || null)} aria-label="Dificuldade">
          <option value="">Qualquer dificuldade</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {LABELS.difficulty[d]}
            </option>
          ))}
        </Select>
        <Select value={filters.maxCostKz} onChange={(e) => setParam('maxCostKz', e.target.value || null)} aria-label="Custo máximo">
          <option value="">Qualquer custo</option>
          {[50_000, 100_000, 200_000, 300_000, 500_000].map((v) => (
            <option key={v} value={v}>
              Até {formatKz(v)}
            </option>
          ))}
        </Select>
        <Button variant={filters.offline ? 'default' : 'outline'} onClick={() => setParam('offline', filters.offline ? null : 'true')}>
          Funciona offline
        </Button>
        <Button variant={filters.favorites ? 'default' : 'outline'} onClick={() => setParam('favorites', filters.favorites ? null : 'true')}>
          <Heart /> Favoritos
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} retry={refetch} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum projeto corresponde aos filtros"
          description={filters.favorites ? 'Ainda não guardaste projetos nos favoritos.' : 'Experimenta alargar a pesquisa ou remover filtros.'}
          action={
            activeFilters && (
              <Button variant="outline" onClick={() => router.replace(path)}>
                <X /> Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-10">
          {grouped.map(({ cat, items }) => {
            const Icon = CATEGORY_ICON[cat];
            return (
              <section key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="font-display text-lg font-semibold">{LABELS.projectCategory[cat]}</h2>
                  <span className="text-sm text-muted-foreground">· {items.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((p) => (
                    <article key={p.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow">
                      <div className="relative">
                        <Photo
                          k={mediaFor(p.slug).photo}
                          sizes="(min-width:1280px) 33vw, (min-width:640px) 50vw, 100vw"
                          className="aspect-[16/9]"
                          imgClassName="transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 [&>*]:border-white/20 [&>*]:bg-black/55 [&>*]:text-white [&>*]:backdrop-blur">
                          <DifficultyBadge value={p.difficulty} />
                          <OfflineBadge offline={p.worksOffline} />
                        </div>
                        <button
                          onClick={() => fav.mutate(p.slug)}
                          aria-label={p.isFavorite ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
                          aria-pressed={p.isFavorite}
                          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60"
                        >
                          <Heart className={cn('size-4', p.isFavorite && 'fill-primary text-primary')} />
                        </button>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                      <Link href={`/lab/${p.slug}`} className="after:absolute after:inset-0">
                        <h3 className="font-display text-base font-semibold leading-snug">{p.title}</h3>
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.tagline}</p>
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-xs">
                        <div>
                          <div className="text-muted-foreground">Custo base</div>
                          <div className="num font-medium">{formatKz(p.baseCostKz)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Montagem</div>
                          <div className="flex items-center gap-1 font-medium">
                            <Clock className="size-3" /> {p.implementationDays} dia(s)
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Materiais</div>
                          <div className="font-medium">{p.componentCount} itens</div>
                        </div>
                      </div>
                      <div className="relative z-10 mt-4 flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={compare.includes(p.slug)} onChange={() => toggleCompare(p.slug)} className="size-4 accent-[hsl(var(--primary))]" />
                          Comparar
                        </label>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {p.hasFirmware && (
                            <Badge tone="green">
                              <Code2 /> Código ESP32
                            </Badge>
                          )}
                          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {compare.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-lg border bg-card/95 p-3 shadow-2xl backdrop-blur lg:left-60">
          <GitCompare className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1 truncate text-sm">
            {compare.length} selecionado(s) <span className="text-muted-foreground">— {compare.join(', ')}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCompare([])}>
            Limpar
          </Button>
          <Button size="sm" disabled={compare.length < 2} asChild={compare.length >= 2}>
            {compare.length >= 2 ? <Link href={`/lab/compare?slugs=${compare.join(',')}`}>Comparar</Link> : <span>Comparar</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LabPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <LabInner />
    </React.Suspense>
  );
}
