'use client';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, CloudOff, Cpu, FlaskConical, ShieldCheck, Sprout, Wallet, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/brand';
import { HeroGlobe } from '@/components/landing/hero-globe';
import { Button } from '@/components/ui/button';
import { useAuth, homeFor } from '@/lib/auth';

const FLOW = [
  { n: '01', title: 'Perfil da propriedade', text: 'Área, solo, água, culturas, energia, internet, problemas e orçamento em Kz — em 5 passos.' },
  { n: '02', title: 'Motor de inteligência agrícola', text: 'Cruza o perfil com a biblioteca de projetos. Exclui o que não se aplica e explica cada recomendação.' },
  { n: '03', title: 'Projeto dimensionado', text: 'Lista de materiais calculada para as tuas zonas, custo, faseamento, esquema de ligação e firmware ESP32.' },
  { n: '04', title: 'Automação segura', text: 'Sensores e bombas no AgroControl, com limites, histórico e proteção contra funcionamento a seco.' },
];

const FEATURES = [
  { icon: FlaskConical, title: 'AgroTech Lab', text: '18 projetos técnicos com componentes, diagramas, montagem, manutenção e limitações honestas.' },
  { icon: Cpu, title: 'AgroControl', text: 'Dispositivos ESP32 via MQTT, leituras em tempo real, regras SE/ENTÃO/ATÉ e comandos validados.' },
  { icon: Bot, title: 'Agro AI', text: 'Assistente que só usa os dados autorizados da tua propriedade e pede o que falta, sem inventar.' },
  { icon: Wallet, title: 'Finanças em Kz', text: 'Despesas, receitas, lucro por cultura e custo de produção por hectare.' },
  { icon: CloudOff, title: 'Funciona com pouca internet', text: 'Registos essenciais guardados offline e sincronizados depois; o ESP32 rega sem ligação.' },
  { icon: ShieldCheck, title: 'Segurança por desenho', text: 'Perfis de acesso, auditoria, isolamento por organização e limites no servidor e no firmware.' },
];

export default function Landing() {
  const { user, status } = useAuth();
  return (
    <div className="dark min-h-dvh bg-night text-snow">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2">
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-field-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-24 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-28">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-tech/30 bg-tech/10 px-3 py-1 text-xs text-mint">
              <Sprout className="size-3.5" /> Agricultura de precisão para Angola
            </span>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Da tua propriedade
              <br />
              <span className="bg-gradient-to-r from-tech to-mint bg-clip-text text-transparent">ao projeto IoT certo.</span>
            </h1>
            <p className="max-w-xl text-base text-snow/70 sm:text-lg">
              O AGROGENIUS analisa cada propriedade — cultura, solo, água, energia, internet e orçamento — e recomenda automações concretas, com
              custos em Kwanza e instruções de montagem.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={user ? homeFor(user) : '/register'}>
                  Analisar a minha propriedade <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/15 text-snow hover:bg-white/10">
                <a href="#como-funciona">Como funciona</a>
              </Button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.1 }} className="flex justify-center">
            <HeroGlobe />
          </motion.div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-tech">Como funciona</p>
          <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight">Transformamos informação agrícola em soluções implementáveis.</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {FLOW.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-lg border border-white/10 bg-white/[0.03] p-5"
              >
                <span className="num font-display text-sm text-tech">{s.n}</span>
                <p className="mt-2 font-display font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-snow/60">{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Caso de referência */}
      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-tech">Caso de referência</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Huambo · 5 ha de milho · poço · rega manual · 300 000 Kz</h2>
            <p className="text-snow/65">
              Resultado do motor de recomendações para o caso de teste usado na validação da plataforma. Não é um cliente real: é o exemplo do
              enunciado do produto, calculado pelo mesmo motor que analisa a tua propriedade.
            </p>
            <ul className="space-y-2 text-sm text-snow/75">
              <li>✔ Excluídos: controlo de bombas (não há bomba), pH e condutividade (não respondem aos objetivos).</li>
              <li>✔ Bomba incluída na lista de materiais porque a propriedade não tem.</li>
              <li>✔ Retorno do investimento não calculado até haver despesas reais registadas.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-2xl">
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
                <div key={l} className="rounded-md border border-white/10 bg-night/60 p-3">
                  <p className="num font-display font-semibold">{v}</p>
                  <p className="text-[11px] text-snow/50">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-tech/30 bg-tech/10 p-3 text-sm">
              <p className="font-medium text-mint">Implementação faseada</p>
              <p className="text-snow/70">Fase 1 — piloto numa zona: 255 500 Kz (cabe no orçamento) · Fase 2 — expansão: 198 000 Kz</p>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-snow/60">
              <li>• A rega é manual em 5 ha: decidir pela humidade real do solo evita regas desnecessárias.</li>
              <li>• Solo argiloso retém água: regar por calendário tende a encharcar.</li>
              <li>• Funciona sem internet: decide localmente e envia dados quando houver ligação.</li>
            </ul>
            <p className="mt-4 text-[10px] text-snow/40">Preços de referência estimados — confirmar com fornecedores locais.</p>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight">Uma plataforma, toda a operação agrícola.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-lg border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-tech/40">
                <f.icon className="size-5 text-tech" />
                <p className="mt-3 font-display font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-snow/60">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Wand2 className="mx-auto size-8 text-tech" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight">Começa pela tua propriedade.</h2>
          <p className="mx-auto mt-2 max-w-xl text-snow/65">Em poucos minutos recebes recomendações ligadas às tuas condições reais — e o caminho para as implementar.</p>
          <Button asChild size="lg" className="mt-6">
            <Link href={user ? homeFor(user) : '/register'}>
              Criar conta gratuita <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-snow/45 sm:flex-row sm:px-6">
          <Logo />
          <p>AGROGENIUS — Intelligent Agriculture Platform · Angola</p>
        </div>
      </footer>
    </div>
  );
}
