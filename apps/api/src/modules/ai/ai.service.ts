import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LABELS, formatKz } from '@agrogenius/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

/** Instruções estáveis (cacheadas). O contexto da propriedade vai num bloco separado a seguir. */
const SYSTEM = `És o Agro AI, assistente agrícola da plataforma AGROGENIUS, para agricultores em Angola.

Regras obrigatórias:
- Usa APENAS os dados fornecidos no bloco <propriedade>. Não inventes leituras de sensores, diagnósticos, previsões de colheita, preços ou produtividades.
- Custos de projetos: cita só os valores calculados pelo motor de recomendações (em Kz) e diz que são estimativas de referência a confirmar com fornecedores locais.
- Se faltar informação para responder bem, diz exatamente que dados faltam e pede-os ao agricultor.
- Distingue claramente factos registados, estimativas e conhecimento agronómico geral.
- Para problemas de pragas/doenças sem dados, recomenda a observação no campo e um técnico agrícola; nunca dês um diagnóstico definitivo.
- Responde em português de Angola, de forma clara e prática, com passos concretos. Usa listas curtas quando ajudar.
- Nunca sugiras contornar proteções de segurança dos equipamentos (ex.: funcionamento a seco da bomba).`;

type Intent = 'AUTOMATION' | 'WATER' | 'SENSORS' | 'YIELD' | 'COST' | 'CROP_TECH' | 'OTHER';

@Injectable()
export class AiService {
  private readonly logger = new Logger('AgroAI');
  private readonly client?: Anthropic;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
    private readonly recs: RecommendationsService,
    config: ConfigService,
  ) {
    const key = config.get<string>('ANTHROPIC_API_KEY');
    this.model = config.get<string>('AI_MODEL') || 'claude-opus-5-5';
    if (key) this.client = new Anthropic({ apiKey: key });
    else this.logger.warn('ANTHROPIC_API_KEY não definido — Agro AI em modo baseado em regras.');
  }

  get mode() {
    return this.client ? 'LLM' : 'RULES';
  }

  conversations(user: AuthUser, farmId?: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId: user.id, ...(farmId ? { farmId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, farmId: true, createdAt: true },
    });
  }

  async conversation(user: AuthUser, id: string) {
    const c = await this.prisma.aiConversation.findFirst({
      where: { id, userId: user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Conversa não encontrada');
    return c;
  }

  /** Contexto da propriedade: só dados a que o utilizador tem acesso. */
  private async farmContext(farmId: string) {
    const [farm, recList] = await Promise.all([
      this.prisma.farm.findUniqueOrThrow({
        where: { id: farmId },
        include: {
          fields: { select: { name: true, areaHa: true, isIrrigationZone: true } },
          plantings: { where: { status: { in: ['PLANNED', 'GROWING'] } }, include: { crop: true, harvests: true } },
          devices: { include: { sensors: true, actuators: true } },
        },
      }),
      this.prisma.recommendation.findMany({ where: { farmId }, include: { project: true }, orderBy: { rawScore: 'desc' } }),
    ]);
    const profile = await this.recs.buildProfile(farmId);
    const sensorIds = farm.devices.flatMap((d) => d.sensors.map((s) => s.id));
    const latest = await Promise.all(
      sensorIds.map((id) => this.prisma.sensorReading.findFirst({ where: { sensorId: id }, orderBy: { recordedAt: 'desc' } })),
    );
    return { farm, recList, profile, latest: latest.filter(Boolean) };
  }

  private renderContext(ctx: Awaited<ReturnType<AiService['farmContext']>>) {
    const { farm, recList, profile, latest } = ctx;
    const lines = [
      `Nome: ${farm.name} — ${farm.province}${farm.municipality ? `, ${farm.municipality}` : ''}`,
      `Área total: ${farm.totalAreaHa} ha; cultivada: ${farm.cultivatedAreaHa} ha; zonas registadas: ${farm.fields.length}`,
      `Solo: ${LABELS.soil[farm.soilType]}; terreno: ${LABELS.terrain[farm.terrainType]}`,
      `Água: ${LABELS.waterAvailability[farm.waterAvailability]}; fonte: ${LABELS.waterSource[farm.waterSource]}; rega: ${LABELS.irrigation[farm.irrigationSystem]}`,
      `Infraestrutura: eletricidade=${farm.hasElectricity ? 'sim' : 'não'}; internet=${LABELS.connectivity[farm.internet]}; bombas=${farm.hasPumps ? 'sim' : 'não'}; sensores=${farm.hasSensors ? 'sim' : 'não'}; máquinas=${farm.hasMachinery ? 'sim' : 'não'}; nível tecnológico=${LABELS.techLevel[farm.techLevel]}`,
      `Orçamento para tecnologia: ${farm.budgetKz ? formatKz(Number(farm.budgetKz)) : 'não indicado'}`,
      `Objetivos: ${farm.goals.map((g) => LABELS.goal[g as keyof typeof LABELS.goal] ?? g).join('; ') || 'não indicados'}`,
      `Problemas declarados: ${farm.problems.map((p) => LABELS.problem[p as keyof typeof LABELS.problem] ?? p).join('; ') || 'nenhum'}`,
      `Culturas ativas: ${farm.plantings.map((p) => `${p.crop.name} (${p.areaHa} ha, necessidade de água ${p.crop.waterNeed})`).join('; ') || 'nenhuma registada'}`,
      `Custos registados 12 meses: rega=${profile.annualIrrigationCostKz === null ? 'sem registos' : formatKz(profile.annualIrrigationCostKz)}; mão de obra=${profile.annualLaborCostKz === null ? 'sem registos' : formatKz(profile.annualLaborCostKz)}`,
      `Dispositivos IoT: ${farm.devices.length ? farm.devices.map((d) => `${d.name} [${d.status}] sensores: ${d.sensors.map((s) => s.kind).join(', ') || '-'}`).join(' | ') : 'nenhum'}`,
      `Últimas leituras: ${latest.length ? latest.map((r) => `${farm.devices.flatMap((d) => d.sensors).find((s) => s.id === r!.sensorId)?.kind}=${r!.value} (${r!.recordedAt.toISOString()})`).join('; ') : 'não existem leituras de sensores'}`,
      '',
      'Recomendações do motor (custos já dimensionados para esta propriedade):',
      ...(recList.length
        ? recList.map(
            (r) =>
              `- ${r.project.title} [prioridade ${LABELS.priority[r.priority]}, pontuação ${r.score}, estado ${LABELS.recommendationStatus[r.status]}]: custo estimado ${formatKz(Number(r.estimatedCostKz))}${r.withinBudget ? '' : ' (excede orçamento)'}; problema: ${r.problem}; razões: ${(r.reasons as { text: string }[]).map((x) => x.text).join(' ')}`,
          )
        : ['- (ainda não geradas)']),
    ];
    return `<propriedade>\n${lines.join('\n')}\n</propriedade>`;
  }

  async ask(user: AuthUser, input: { message: string; farmId?: string; conversationId?: string }) {
    let farmId = input.farmId;
    let conversationId = input.conversationId;
    let history: { role: string; content: string }[] = [];

    if (conversationId) {
      const conv = await this.conversation(user, conversationId);
      farmId = conv.farmId ?? farmId;
      history = conv.messages.map((m) => ({ role: m.role, content: m.content }));
    }
    if (!farmId) {
      const [first] = await this.access.farmIds(user);
      farmId = first;
    }
    if (farmId) await this.access.assert(user, farmId);

    if (!conversationId) {
      const conv = await this.prisma.aiConversation.create({
        data: { userId: user.id, farmId, title: input.message.slice(0, 80) },
      });
      conversationId = conv.id;
    }
    await this.prisma.aiMessage.create({ data: { conversationId, role: 'user', content: input.message } });

    let answer: string;
    let engine: 'LLM' | 'RULES';
    if (!farmId) {
      answer = 'Ainda não tens nenhuma propriedade registada. Conclui o onboarding para que eu possa analisar a tua realidade e dar recomendações concretas.';
      engine = 'RULES';
    } else {
      const ctx = await this.farmContext(farmId);
      if (this.client) {
        try {
          answer = await this.askLlm(this.renderContext(ctx), history, input.message);
          engine = 'LLM';
        } catch (e) {
          this.logger.warn(`Falha no LLM, a usar modo de regras: ${(e as Error).message}`);
          answer = this.rulesAnswer(ctx, input.message);
          engine = 'RULES';
        }
      } else {
        answer = this.rulesAnswer(ctx, input.message);
        engine = 'RULES';
      }
    }

    const msg = await this.prisma.aiMessage.create({ data: { conversationId, role: 'assistant', content: answer, engine } });
    return { conversationId, message: msg };
  }

  private async askLlm(context: string, history: { role: string; content: string }[], message: string) {
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.slice(-20).map((m) => ({ role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const), content: m.content })),
      { role: 'user', content: message },
    ];
    const response = await this.client!.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      // Fallback do servidor em caso de recusa por classificadores de segurança
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: context },
      ],
      messages,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === 'refusal') {
      return 'Não consigo responder a esse pedido. Reformula a pergunta com foco na gestão da tua propriedade.';
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (response.stop_reason === 'max_tokens') return `${text}\n\n_(resposta interrompida por ser demasiado longa)_`;
    return text || 'Não obtive resposta. Tenta novamente.';
  }

  private intent(q: string): Intent {
    const s = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/(quanto custa|custo|preco|orcamento|kwanza|kz)/.test(s)) return 'COST';
    if (/(agua|regar|rega|irriga)/.test(s) && /(reduz|poupar|consumo|gast|desperd)/.test(s)) return 'WATER';
    if (/(sensor|medir|monitoriz)/.test(s)) return 'SENSORS';
    if (/(produtiv|rendimento|colheita|produzir mais)/.test(s)) return 'YIELD';
    if (/(automa|iot|esp32|tecnologia)/.test(s) && /(cultura|milho|feijao|tomate|mandioca)/.test(s)) return 'CROP_TECH';
    if (/(automa|iot|esp32|melhor tecnologia|projeto)/.test(s)) return 'AUTOMATION';
    if (/(agua|rega|irriga)/.test(s)) return 'WATER';
    return 'OTHER';
  }

  /** Modo sem LLM: respostas determinísticas construídas apenas a partir dos dados e do motor. */
  private rulesAnswer(ctx: Awaited<ReturnType<AiService['farmContext']>>, q: string): string {
    const { farm, recList, profile } = ctx;
    const intent = this.intent(q);
    const pick = (cats: string[]) => recList.filter((r) => cats.includes(r.project.category) && r.status !== 'DISMISSED');
    const fmt = (r: (typeof recList)[number]) =>
      `• **${r.project.title}** — prioridade ${LABELS.priority[r.priority].toLowerCase()}, custo estimado ${formatKz(Number(r.estimatedCostKz))}${r.withinBudget ? '' : ' (excede o orçamento; ver faseamento)'}.\n  Porquê: ${(r.reasons as { text: string }[]).slice(0, 3).map((x) => x.text).join(' ')}`;
    const header = '_Modo baseado em regras (sem IA generativa): respostas construídas a partir dos dados da tua propriedade e do motor de recomendações._\n\n';
    const missing: string[] = [];
    if (profile.budgetKz === null) missing.push('orçamento disponível');
    if (profile.crops.length === 0) missing.push('culturas cultivadas');
    if (profile.zoneCount === 0) missing.push('zonas da propriedade');
    const ask = missing.length ? `\n\nPara uma análise mais precisa, preciso de: ${missing.join(', ')}.` : '';

    if (!recList.length) {
      return `${header}Ainda não há recomendações para ${farm.name}. Abre a página de recomendações e clica em "Analisar propriedade".${ask}`;
    }
    switch (intent) {
      case 'WATER': {
        const items = pick(['SMART_IRRIGATION', 'RESOURCE_MANAGEMENT']);
        if (!items.length) return `${header}Com os dados atuais não há projetos de água aplicáveis (fonte de água: ${LABELS.waterSource[farm.waterSource]}).${ask}`;
        return `${header}Para reduzir o consumo de água em ${farm.name} (rega atual: ${LABELS.irrigation[farm.irrigationSystem].toLowerCase()}):\n\n${items.slice(0, 3).map(fmt).join('\n\n')}\n\nComeça por medir: sem medição de humidade ou caudal não é possível saber quanto se poupa.${ask}`;
      }
      case 'SENSORS': {
        const items = pick(['SOIL_MONITORING', 'ENVIRONMENTAL_MONITORING', 'SMART_IRRIGATION']);
        return `${header}Sensores recomendados para ${farm.name}:\n\n${items.slice(0, 3).map(fmt).join('\n\n')}${ask}`;
      }
      case 'COST': {
        const top = recList.filter((r) => r.status !== 'DISMISSED').slice(0, 4);
        const lines = top.map((r) => {
          const phases = (r.phases as { name: string; costKz: number }[] | null) ?? [];
          return `• ${r.project.title}: ${formatKz(Number(r.estimatedCostKz))}${phases.length ? ` — ou faseado: ${phases.map((p) => `${p.name} ${formatKz(p.costKz)}`).join('; ')}` : ''}`;
        });
        return `${header}Custos estimados (preços de referência, confirmar com fornecedores locais), já dimensionados para ${farm.cultivatedAreaHa} ha:\n\n${lines.join('\n')}\n\nOrçamento indicado: ${farm.budgetKz ? formatKz(Number(farm.budgetKz)) : 'não indicado'}.${ask}`;
      }
      case 'YIELD': {
        const items = recList.filter((r) => r.status !== 'DISMISSED').slice(0, 3);
        return `${header}Não tenho dados de produção suficientes para prever a produtividade${profile.crops.length ? '' : ' (não há culturas registadas)'}. Regista as colheitas reais para comparar épocas.\n\nProjetos que atuam sobre fatores de produtividade na tua propriedade:\n\n${items.map(fmt).join('\n\n')}${ask}`;
      }
      default: {
        const items = recList.filter((r) => r.status !== 'DISMISSED').slice(0, 3);
        return `${header}As automações mais adequadas para ${farm.name}, por ordem de prioridade:\n\n${items.map(fmt).join('\n\n')}${ask}`;
      }
    }
  }
}
