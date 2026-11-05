import { BadRequestException, Injectable } from '@nestjs/common';
import { LABELS, formatKz } from '@agrogenius/shared';
import type { AuthUser } from '../../common/auth.decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService } from '../access/farm-access.service';
import { FinanceService } from '../finance/finance.service';
import { ProductionService } from '../production/production.service';
import { ReportDoc } from './pdf';

export const REPORT_TYPES = ['farm', 'production', 'finance', 'sensors', 'water', 'recommendations', 'projects'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const d = (x: Date | null | undefined) => (x ? new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeZone: 'Africa/Luanda' }).format(x) : '—');
const n = (x: unknown, digits = 1) => (x === null || x === undefined ? '—' : new Intl.NumberFormat('pt-AO', { maximumFractionDigits: digits }).format(Number(x)));

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FarmAccessService,
    private readonly finance: FinanceService,
    private readonly production: ProductionService,
  ) {}

  async build(user: AuthUser, type: ReportType, farmId: string, from: Date, to: Date): Promise<{ buffer: Buffer; filename: string }> {
    await this.access.assert(user, farmId);
    const farm = await this.prisma.farm.findUniqueOrThrow({ where: { id: farmId }, include: { owner: { select: { fullName: true } } } });
    const period = `${d(from)} – ${d(to)}`;
    const sub = `${farm.name} · ${farm.province}${farm.municipality ? `, ${farm.municipality}` : ''} · ${period}`;
    let doc: ReportDoc;

    switch (type) {
      case 'farm': {
        doc = new ReportDoc('Relatório da propriedade', sub);
        const full = await this.prisma.farm.findUniqueOrThrow({
          where: { id: farmId },
          include: { fields: true, plantings: { include: { crop: true } }, devices: { include: { sensors: true } }, farmProjects: { include: { project: true } } },
        });
        if (farm.isDemo) doc.note('Propriedade de demonstração — dados fictícios identificados como tal.');
        doc.section('Identificação').kv([
          ['Proprietário', farm.owner.fullName],
          ['Localização', `${farm.province}${farm.municipality ? ` / ${farm.municipality}` : ''}`],
          ['Coordenadas', farm.latitude !== null ? `${farm.latitude?.toFixed(5)}, ${farm.longitude?.toFixed(5)}` : 'não registadas'],
          ['Área total / cultivada', `${n(farm.totalAreaHa)} ha / ${n(farm.cultivatedAreaHa)} ha`],
          ['Solo', LABELS.soil[farm.soilType]],
          ['Terreno', LABELS.terrain[farm.terrainType]],
          ['Água', `${LABELS.waterAvailability[farm.waterAvailability]} · ${LABELS.waterSource[farm.waterSource]}`],
          ['Rega', LABELS.irrigation[farm.irrigationSystem]],
          ['Eletricidade / Internet', `${farm.hasElectricity ? 'Sim' : 'Não'} / ${LABELS.connectivity[farm.internet]}`],
          ['Orçamento tecnologia', farm.budgetKz ? formatKz(Number(farm.budgetKz)) : 'não indicado'],
        ]);
        doc.section('Zonas').table(['Zona', 'Área (ha)', 'Solo', 'Rega'], full.fields.map((f) => [f.name, n(f.areaHa), f.soilType ? LABELS.soil[f.soilType] : '—', f.isIrrigationZone ? 'Sim' : 'Não']));
        doc.section('Culturas').table(
          ['Cultura', 'Área (ha)', 'Estado', 'Plantação', 'Colheita prevista'],
          full.plantings.map((p) => [p.crop.name, n(p.areaHa), LABELS.plantingStatus[p.status], d(p.plantedAt), d(p.expectedHarvestAt)]),
        );
        doc.section('Dispositivos IoT').table(['Dispositivo', 'Tipo', 'Estado', 'Sensores'], full.devices.map((x) => [x.name, LABELS.deviceType[x.type], LABELS.deviceStatus[x.status], x.sensors.length]));
        doc.section('Projetos associados').table(['Projeto', 'Estado', 'Custo real'], full.farmProjects.map((p) => [p.project.title, p.status, p.actualCostKz ? formatKz(Number(p.actualCostKz)) : '—']));
        break;
      }
      case 'production': {
        doc = new ReportDoc('Relatório de produção', sub);
        const plantings = await this.prisma.planting.findMany({
          where: { farmId, OR: [{ plantedAt: { gte: from, lte: to } }, { harvests: { some: { date: { gte: from, lte: to } } } }, { status: 'GROWING' }] },
          include: { crop: true, harvests: { where: { date: { gte: from, lte: to } } }, activities: { where: { date: { gte: from, lte: to } } } },
        });
        doc.section('Produtividade por plantação').table(
          ['Cultura', 'Área', 'Estimado (kg)', 'Colhido (kg)', 'kg/ha real'],
          plantings.map((p) => {
            const kg = p.harvests.reduce((s, h) => s + Number(h.quantityKg), 0);
            return [p.crop.name, `${n(p.areaHa)} ha`, n(p.estimatedYieldKg, 0), kg ? n(kg, 0) : '—', kg ? n(kg / Number(p.areaHa), 0) : '—'];
          }),
        );
        doc.note('"Estimado" é o valor declarado pelo agricultor; "Colhido" é a produção real registada.');
        doc.section('Atividades de campo').table(
          ['Data', 'Cultura', 'Tipo', 'Produto', 'Quantidade'],
          plantings.flatMap((p) => p.activities.map((a) => [d(a.date), p.crop.name, LABELS.activity[a.type], a.product ?? '—', a.quantity ? `${n(a.quantity)} ${a.unit ?? ''}` : '—'])),
        );
        break;
      }
      case 'finance': {
        doc = new ReportDoc('Relatório financeiro', sub);
        const s = await this.finance.summary(user, { farmId, from, to });
        doc.section('Resumo').kv([
          ['Receitas', formatKz(s.income)],
          ['Despesas', formatKz(s.expense)],
          ['Resultado', formatKz(s.balance)],
          ['Transações', String(s.transactions)],
        ]);
        doc.section('Despesas por categoria').table(['Categoria', 'Valor'], s.byCategory.map((c) => [LABELS.transactionCategory[c.category as keyof typeof LABELS.transactionCategory] ?? c.category, formatKz(c.amount)]), [300, 199]);
        doc.section('Resultado por cultura').table(['Cultura', 'Receitas', 'Despesas', 'Lucro', 'Custo/ha'], s.byCrop.map((c) => [c.crop, formatKz(c.income), formatKz(c.expense), formatKz(c.profit), c.costPerHa ? formatKz(c.costPerHa) : '—']));
        doc.section('Evolução mensal').table(['Mês', 'Receitas', 'Despesas'], s.byMonth.map((m) => [m.month, formatKz(m.income), formatKz(m.expense)]));
        doc.note('Apenas transações registadas na plataforma. Transações sem cultura associada não entram no resultado por cultura.');
        break;
      }
      case 'sensors':
      case 'water': {
        doc = new ReportDoc(type === 'water' ? 'Relatório de consumo de água' : 'Relatório de sensores', sub);
        const sensors = await this.prisma.sensor.findMany({
          where: { device: { farmId }, ...(type === 'water' ? { kind: { in: ['WATER_FLOW', 'WATER_LEVEL', 'SOIL_MOISTURE'] } } : {}) },
          include: { device: { select: { name: true } }, field: { select: { name: true } } },
        });
        const stats = await Promise.all(
          sensors.map((s) =>
            this.prisma.sensorReading.aggregate({ where: { sensorId: s.id, recordedAt: { gte: from, lte: to } }, _avg: { value: true }, _min: { value: true }, _max: { value: true }, _count: true }),
          ),
        );
        doc.section('Estatísticas por sensor').table(
          ['Dispositivo', 'Sensor', 'Zona', 'Leituras', 'Média', 'Mín', 'Máx'],
          sensors.map((s, i) => [s.device.name, `${LABELS.sensorKind[s.kind]} (${s.unit})`, s.field?.name ?? '—', stats[i]._count, n(stats[i]._avg.value), n(stats[i]._min.value), n(stats[i]._max.value)]),
          [80, 110, 70, 55, 60, 62, 62],
        );
        if (type === 'water') {
          const flow = sensors.filter((s) => s.kind === 'WATER_FLOW');
          if (!flow.length) doc.note('Não existe sensor de caudal: o volume de água consumido não pode ser medido. Ver projeto "Monitorização do consumo de água".');
          const rules = await this.prisma.command.count({ where: { actuator: { device: { farmId } }, action: 'ON', status: 'ACKED', createdAt: { gte: from, lte: to } } });
          doc.section('Rega').kv([['Ativações de rega confirmadas', String(rules)], ['Sensores de caudal', String(flow.length)]]);
        }
        if (!sensors.length) doc.note('Não há sensores registados nesta propriedade.');
        break;
      }
      case 'recommendations': {
        doc = new ReportDoc('Recomendações IoT', sub);
        const recs = await this.prisma.recommendation.findMany({ where: { farmId }, include: { project: true }, orderBy: { score: 'desc' } });
        doc.note('Custos calculados com preços de referência AGROGENIUS — são estimativas, confirmar com fornecedores locais.');
        for (const r of recs) {
          doc.section(`${r.project.title} — prioridade ${LABELS.priority[r.priority].toLowerCase()}`);
          doc.kv([
            ['Problema', r.problem],
            ['Custo estimado', `${formatKz(Number(r.estimatedCostKz))}${r.withinBudget ? '' : ' (excede orçamento)'}`],
            ['Pontuação', `${r.score}/100`],
            ['Estado', LABELS.recommendationStatus[r.status]],
          ]);
          doc.paragraph((r.reasons as { text: string }[]).map((x) => `• ${x.text}`).join('\n'));
          const bom = r.bom as { name: string; quantity: number; unitPriceKz: number; totalKz: number; optional: boolean }[];
          doc.table(['Componente', 'Qtd', 'Preço unit.', 'Total'], bom.map((b) => [`${b.name}${b.optional ? ' (opcional)' : ''}`, b.quantity, formatKz(b.unitPriceKz), formatKz(b.totalKz)]), [260, 50, 95, 94]);
          const phases = (r.phases as { name: string; costKz: number }[] | null) ?? [];
          if (phases.length) doc.paragraph(`Implementação faseada: ${phases.map((p) => `${p.name}: ${formatKz(p.costKz)}`).join(' · ')}`);
          const roi = r.roi as { kind: string; annualSavingsKz?: number; paybackMonths?: number; missing?: string[] } | null;
          if (roi?.kind === 'ESTIMATE') doc.paragraph(`Retorno ESTIMADO: poupança anual ~${formatKz(roi.annualSavingsKz)}; recuperação do investimento ~${roi.paybackMonths} meses.`);
          else if (roi) doc.note(`Retorno do investimento não calculado — dados em falta: ${(roi.missing ?? []).join('; ')}`);
          if (r.warnings.length) doc.note(r.warnings.join(' '));
        }
        if (!recs.length) doc.paragraph('Ainda não foram geradas recomendações para esta propriedade.');
        break;
      }
      case 'projects': {
        doc = new ReportDoc('Projetos implementados', sub);
        const fps = await this.prisma.farmProject.findMany({ where: { farmId }, include: { project: true, recommendation: true } });
        doc.section('Projetos').table(
          ['Projeto', 'Estado', 'Início', 'Conclusão', 'Estimado', 'Real'],
          fps.map((p) => [p.project.title, p.status, d(p.startedAt), d(p.completedAt), p.recommendation ? formatKz(Number(p.recommendation.estimatedCostKz)) : '—', p.actualCostKz ? formatKz(Number(p.actualCostKz)) : '—']),
        );
        const iot = await this.finance.summary(user, { farmId, from, to });
        const inv = iot.byCategory.find((c) => c.category === 'IOT');
        doc.section('Investimento IoT registado').kv([['Total no período', formatKz(inv?.amount ?? 0)]]);
        break;
      }
      default:
        throw new BadRequestException('Tipo de relatório inválido');
    }
    void this.production;
    const buffer = await doc.finish();
    const slug = farm.name.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase();
    return { buffer, filename: `agrogenius-${type}-${slug}-${to.toISOString().slice(0, 10)}.pdf` };
  }
}
