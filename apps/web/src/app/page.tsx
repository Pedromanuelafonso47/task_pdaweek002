'use client';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, CloudOff, Cpu, Droplets, FlaskConical, MapPin, ShieldCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/brand';
import { SystemIllustration } from '@/components/illustrations/system-illustration';
import { HeroGlobe } from '@/components/landing/hero-globe';
import { Photo, PhotoCredit } from '@/components/photo';
import { Button } from '@/components/ui/button';
import type { PhotoKey } from '@/content/photos';
import { homeFor, useAuth } from '@/lib/auth';

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const FIELD_PROJECTS: { photo: PhotoKey; title: string; text: string; tag: string }[] = [
  { photo: 'rede-sensores-campo', tag: 'Irrigação inteligente', title: 'Rega que decide pela humidade do solo', text: 'Sensores na raiz, ESP32 no campo e válvula por zona. Funciona sem internet.' },
  { photo: 'kit-gota-a-gota', tag: 'Gota-a-gota', title: 'A água certa, na raiz', text: 'Depósito, filtro e linhas de gotejadores — automatizados por zona e por horário.' },
  { photo: 'sensor-humidade-solo', tag: 'Monitorização do solo', title: 'Saber antes de regar', text: 'Sondas de humidade, pH e temperatura que mostram o que a terra precisa.' },
  { photo: 'estacao-meteorologica', tag: 'Clima local', title: 'O clima da tua lavra', text: 'Estação com chuva, temperatura e humidade — e rega suspensa quando chove.' },
  { photo: 'estufa-pimentos', tag: 'Estufas', title: 'Calor sob controlo', text: 'Ventilação automática quando a temperatura sobe acima do limite da cultura.' },
  { photo: 'bomba-solar-comunidade', tag: 'Energia e bombas', title: 'Bombas protegidas, energia medida', text: 'Proteção contra funcionamento a seco e custo real de cada rega.' },
];

const FEATURES = [
  { icon: FlaskConical, title: 'AgroTech Lab', text: '18 projetos com materiais, esquemas, firmware ESP32 e limitações honestas.' },
  { icon: Cpu, title: 'AgroControl', text: 'Sensores e bombas em tempo real, regras SE/ENTÃO/ATÉ e comandos sempre validados.' },
  { icon: Bot, title: 'Agro AI', text: 'Um assistente que só usa os dados da tua propriedade — e pede o que falta.' },
  { icon: Wallet, title: 'Finanças em Kz', text: 'Despesas, vendas, lucro por cultura e custo por hectare.' },
  { icon: CloudOff, title: 'Pouca internet? Funciona.', text: 'Registos guardados offline; o ESP32 rega mesmo sem ligação.' },
  { icon: ShieldCheck, title: 'Seguro por desenho', text: 'Perfis de acesso, auditoria e limites no servidor e no firmware.' },
];

export default function Landing() {
  const { user, status } = useAuth();
  const cta = user ? homeFor(user) : '/register';

  return (
    <div className="dark min-h-dvh bg-night text-snow">
      {/* ── Navegação ── */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#como-funciona" className="hidden rounded-md px-3 py-2 text-sm text-snow/80 hover:text-snow md:block">
              Como funciona
            </a>
            <a href="#projetos" className="hidden rounded-md px-3 py-2 text-sm text-snow/80 hover:text-snow md:block">
              Projetos
            </a>
            {status === 'authenticated' && user ? (
              <Button asChild size="sm">
                <Link href={homeFor(user)}>Abrir painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost" className="text-snow hover:bg-white/10">
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Criar conta</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero: a terra e quem a trabalha ── */}
      <section className="relative isolate flex min-h-[92svh] items-end overflow-hidden">
        <Photo k="angola-namibe-campo" priority sizes="100vw" className="absolute inset-0 -z-10" imgClassName="scale-105 object-[center_40%]" credit="none" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/55 to-transparent" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-transparent to-night/30" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-32 sm:px-6 sm:pb-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-night/40 px-3 py-1 text-xs text-mint backdrop-blur">
              <MapPin className="size-3.5" /> Feito para as lavras de Angola
            </span>
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              A tua terra
              <br />
              <span className="bg-gradient-to-r from-tech via-mint to-tech bg-clip-text text-transparent">merece decisões com dados.</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-snow/80 sm:text-lg">
              Olhamos para a tua propriedade como ela é — o solo, a água, as culturas, a energia e o orçamento — e mostramos o projeto de automação
              certo, com custo em Kwanza e o passo a passo para o montar.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-glow">
                <Link href={cta}>
                  Analisar a minha propriedade <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-night/30 text-snow backdrop-blur hover:bg-white/10">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
          </motion.div>
        </div>
        <p className="absolute bottom-3 right-4 max-w-[70%] text-right text-[10px] text-snow/55">
          Agricultoras na província do Namibe, Angola · <PhotoCredit k="angola-namibe-campo" />
        </p>
      </section>

      {/* ── A realidade ── */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <motion.div {...fadeUp} className="grid grid-cols-6 grid-rows-[220px_180px] gap-3 sm:grid-rows-[300px_220px]">
            <Photo k="angola-colheita-batata" sizes="(min-width:1024px) 40vw, 100vw" className="col-span-6 rounded-2xl" />
            <Photo k="rega-manual-balde" sizes="(min-width:1024px) 20vw, 50vw" className="col-span-3 rounded-2xl" />
            <Photo k="bomba-manual-agua" sizes="(min-width:1024px) 20vw, 50vw" className="col-span-3 rounded-2xl" />
          </motion.div>
          <motion.div {...fadeUp} className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-tech">Quem alimenta o país</p>
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Cada balde de água carregado à mão é tempo e força que não voltam.
            </h2>
            <p className="text-snow/70">
              Em muitas lavras, a rega ainda se faz por calendário ou a olho — às vezes a mais, às vezes tarde demais. A água do poço acaba, a bomba
              trabalha em seco, a chuva cai depois de se ter regado. Ninguém regista quanto custou.
            </p>
            <p className="text-snow/70">
              O AGROGENIUS existe para mudar isso com tecnologia simples, barata e que aguenta o campo: sensores que medem, um pequeno controlador
              que decide e uma plataforma que guarda a história da tua propriedade.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Como funciona: ilustração animada ── */}
      <section id="como-funciona" className="relative border-y border-white/5 bg-gradient-to-b from-deep/40 to-night py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-tech">Do sensor à raiz</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Assim funciona uma rega inteligente no teu campo.</h2>
            <p className="mt-3 text-snow/65">
              O mesmo ciclo que o firmware ESP32 da plataforma executa — com os limites da tua cultura e proteção da bomba incluídos.
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="mx-auto mt-10 max-w-5xl">
            <SystemIllustration kind="irrigation" className="border-white/10 shadow-[0_40px_120px_-40px_rgba(39,199,123,0.45)]" />
          </motion.div>
        </div>
      </section>

      {/* ── Projetos no terreno ── */}
      <section id="projetos" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-tech">AgroTech Lab</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Projetos que já funcionam no campo.</h2>
              <p className="mt-3 text-snow/65">
                Cada projeto vem com lista de materiais, esquema de ligação, código ESP32, montagem e manutenção — e é dimensionado para a tua área.
              </p>
            </div>
            <Button asChild variant="outline" className="border-white/20 text-snow hover:bg-white/10">
              <Link href={user ? '/lab' : '/register'}>
                Explorar os 18 projetos <ArrowRight />
              </Link>
            </Button>
          </motion.div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_PROJECTS.map((p, i) => (
              <motion.article
                key={p.photo}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.08 }}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
              >
                <Photo k={p.photo} sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="aspect-[4/3]" imgClassName="transition-transform duration-700 group-hover:scale-105" />
                <div className="space-y-1.5 p-5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-tech">{p.tag}</span>
                  <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                  <p className="text-sm text-snow/65">{p.text}</p>
                </div>
              </motion.article>
            ))}
          </div>
          <p className="mt-4 text-xs text-snow/45">Fotografias de sistemas semelhantes em uso, com licença livre — créditos em cada imagem.</p>
        </div>
      </section>

      {/* ── Caso de referência ── */}
      <section className="relative isolate overflow-hidden py-20 sm:py-28">
        <Photo k="angola-bie-feijao" sizes="100vw" className="absolute inset-0 -z-10" credit="none" />
        <div className="absolute inset-0 -z-10 bg-night/85" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <motion.div {...fadeUp} className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-tech">Um exemplo real de cálculo</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Huambo · 5 ha de milho · poço · rega manual · 300 000 Kz</h2>
            <p className="text-snow/70">
              É o caso de teste usado para validar a plataforma (não é um cliente). O mesmo motor que analisa a tua propriedade decidiu assim — e
              explicou porquê:
            </p>
            <ul className="space-y-2 text-sm text-snow/80">
              <li className="flex gap-2"><Droplets className="mt-0.5 size-4 shrink-0 text-tech" /> Rega manual em 5 ha e solo argiloso: regar pela humidade real evita encharcar.</li>
              <li className="flex gap-2"><Droplets className="mt-0.5 size-4 shrink-0 text-tech" /> Não há bomba — por isso entra na lista de materiais.</li>
              <li className="flex gap-2"><Droplets className="mt-0.5 size-4 shrink-0 text-tech" /> O total passa o orçamento: propõe começar por um piloto que cabe.</li>
              <li className="flex gap-2"><Droplets className="mt-0.5 size-4 shrink-0 text-tech" /> Sem custos registados, não inventa o retorno do investimento.</li>
            </ul>
            <p className="text-[11px] text-snow/45">
              Fundo: feijão acabado de colher, província do Bié · <PhotoCredit k="angola-bie-feijao" />
            </p>
          </motion.div>
          <motion.div {...fadeUp} className="rounded-2xl border border-white/10 bg-night/70 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-snow/50">#1 · Desperdício de água</p>
                <p className="font-display text-xl font-semibold">Irrigação inteligente com ESP32</p>
              </div>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">Prioridade alta</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ['85/100', 'Pontuação'],
                ['4 zonas', 'Dimensionamento'],
                ['453 500 Kz', 'Total estimado'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="num font-display font-semibold">{v}</p>
                  <p className="text-[11px] text-snow/50">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-tech/30 bg-tech/10 p-3 text-sm">
              <p className="font-medium text-mint">Começar pequeno</p>
              <p className="text-snow/75">Fase 1 — piloto numa zona: 255 500 Kz (cabe no orçamento) · Fase 2 — expansão: 198 000 Kz</p>
            </div>
            <p className="mt-4 text-[10px] text-snow/45">Preços de referência estimados — confirmar com fornecedores locais.</p>
          </motion.div>
        </div>
      </section>

      {/* ── Angola, província a província ── */}
      <section id="provincias" className="scroll-mt-16 py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div {...fadeUp} className="space-y-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-tech">21 províncias, climas diferentes</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Do deserto do Namibe às chuvas do Uíge.</h2>
            <p className="text-snow/70">
              O que serve ao planalto do Huambo não serve ao litoral de Benguela. O AGROGENIUS começa pela tua província e termina na tua lavra.
              Toca numa província no globo para veres o que muda.
            </p>
            <Photo k="angola-malanje-rio-lucala" sizes="(min-width:1024px) 45vw, 100vw" className="aspect-[16/9] rounded-2xl" caption />
          </motion.div>
          <motion.div {...fadeUp} className="flex justify-center">
            <HeroGlobe />
          </motion.div>
        </div>
      </section>

      {/* ── Funcionalidades ── */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight">Uma plataforma para toda a operação.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-tech/40">
                <f.icon className="size-5 text-tech" />
                <p className="mt-3 font-display font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-snow/60">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Fecho emotivo ── */}
      <section className="relative isolate overflow-hidden">
        <Photo k="agricultora-horta" sizes="100vw" className="absolute inset-0 -z-10" imgClassName="object-[center_30%]" credit="none" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night via-night/80 to-night/20" />
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <motion.div {...fadeUp} className="max-w-xl space-y-5">
            <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Cultivar com menos incerteza começa hoje.</h2>
            <p className="text-snow/75">Cinco passos sobre a tua propriedade. Recomendações que fazem sentido para ela. E o caminho para as pôr a funcionar.</p>
            <Button asChild size="lg" className="shadow-glow">
              <Link href={cta}>
                Criar conta gratuita <ArrowRight />
              </Link>
            </Button>
          </motion.div>
        </div>
        <p className="absolute bottom-3 right-4 text-[10px] text-snow/55">
          <PhotoCredit k="agricultora-horta" />
        </p>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-snow/45 sm:flex-row sm:px-6">
          <Logo />
          <p>
            AGROGENIUS · Angola ·{' '}
            <Link href="/creditos" className="underline-offset-2 hover:text-snow hover:underline">
              Créditos das fotografias
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
