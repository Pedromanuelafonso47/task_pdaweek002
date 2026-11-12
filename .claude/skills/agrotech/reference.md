# Referência — agrotech

Detalhe que só importa depois de a skill disparar. Tudo aqui bate com o código do motor
(`apps/api/src/modules/recommendations/engine/`) e do catálogo (`apps/api/src/modules/projects/catalog/`).
Os dois exemplos completos foram gerados com o próprio motor (`recommend()`), não escritos à mão.

## 1. Formato exato da saída

A resposta tem sempre três blocos, nesta ordem.

### 1.1 Perfil entendido

Uma tabela com o `FarmProfile` que foi extraído da descrição. Cada campo diz se foi **dito** pelo agricultor
ou **assumido**. Um campo assumido tem de ser confirmado e aparece também em "O que falta saber".

### 1.2 Sugestões para o agricultor (Markdown)

Até 3 projetos, do mais pontuado para o menos. Para cada um:

```
### <n>. <título do catálogo> (`<slug>`) — <score>/100 · prioridade <BAIXA|MÉDIA|ALTA|CRÍTICA>
**Problema que resolve:** <problem>
**Porquê nesta lavra:** <2–4 razões, em texto corrido, tiradas de reasons[]>
**Custo estimado:** <estimatedCostKz> Kz — <cabe | não cabe> no orçamento de <budgetKz> Kz
<se houver fases: Fase 1 … Kz · Fase 2 … Kz>
**Atenção:** <warnings[]>
```

No fim, sempre:

- **O que falta saber:** a lista de `missingData`.
- **Projetos excluídos:** só os relevantes, com o motivo (`excluded[]`).
- A frase obrigatória: *"Preços são estimativas de referência AGROGENIUS — confirmar com fornecedores locais."*
- A frase *"Retorno do investimento: não calculado — faltam custos reais de rega e mão de obra."* quando
  `roi.kind` é `INSUFFICIENT_DATA`.

### 1.3 Bloco JSON (compatível com `EngineResult`)

Um bloco ```json com a forma de `EngineResult` (`engine/types.ts`), para que a sugestão possa ser comparada
com o motor ou gravada como `Recommendation` (`schema.prisma`). A sugestão principal leva os campos todos;
as restantes podem levar só `projectSlug`, `score`, `priority`, `estimatedCostKz` e `withinBudget`.

```ts
{
  version: 'rules-1.0.0',
  recommendations: EngineRecommendation[],   // projectSlug, score, rawScore, priority, problem,
                                             // reasons[{code,text,weight}], bom[], estimatedCostKz,
                                             // withinBudget, phases[], roi, warnings[]
  excluded: { projectSlug: string; reason: string }[],
  missingData: string[]
}
```

### Exemplo completo de saída (caso Huambo)

**Descrição:** "Sou do Huambo, tenho 5 hectares de milho, o solo é barrento. Tiro a água do poço e rego à
mão com regadores, gasta-se muita água. Tenho luz da rede mas a internet é fraca. Quero automatizar a rega
e posso gastar 300 mil kwanzas."

**Perfil entendido**

| Campo | Valor | Origem |
|---|---|---|
| province | Huambo | dito |
| cultivatedAreaHa / totalAreaHa | 5 / 5 | dito |
| crops | Milho, 5 ha, `waterNeed: MEDIUM` | dito (necessidade do catálogo de culturas) |
| soilType | `CLAY` | dito ("barrento") |
| waterSource / irrigationSystem | `WELL` / `MANUAL` | dito |
| waterAvailability | `MODERATE` | assumido |
| hasElectricity / internet | `true` / `LIMITED` | dito |
| hasPumps / hasSensors | `false` / `false` | assumido (não mencionou) |
| techLevel | `BASIC` | assumido |
| budgetKz | 300 000 | dito |
| problems / goals | `WATER_WASTE` / `REDUCE_WATER`, `AUTOMATE_IRRIGATION` | dito |
| zoneCount | 0 (motor assume 4 zonas de ~1,5 ha) | assumido |

**Sugestões**

### 1. Irrigação inteligente com ESP32 (`esp32-smart-irrigation`) — 85/100 · prioridade ALTA
**Problema que resolve:** Desperdício de água
**Porquê nesta lavra:** declaraste desperdício de água e queres reduzir o consumo e automatizar a rega; a rega
é manual em 5 ha e o solo argiloso encharca quando se rega por calendário; funciona sem internet.
**Custo estimado:** 453 500 Kz — não cabe no orçamento de 300 000 Kz, mas o piloto cabe.
Fase 1 — Piloto numa zona: 255 500 Kz · Fase 2 — Expansão para 4 zonas: 198 000 Kz
**Atenção:** a lavra ainda não tem zonas registadas (assumidas 4 de ~1,5 ha); recomenda-se começar pelo piloto.

### 2. Pluviómetro com alertas (`rain-gauge-alerts`) — 60/100 · prioridade ALTA
**Custo estimado:** 85 500 Kz — cabe no orçamento.

### 3. Gota-a-gota automatizado (`automated-drip-irrigation`) — 60/100 · prioridade ALTA
**Custo estimado:** 4 786 000 Kz — não cabe no orçamento (o kit gota-a-gota custa 900 000 Kz por hectare).

**O que falta saber:** divisão da propriedade em zonas; registo de despesas de rega (para estimar retorno).
**Projetos excluídos:** `smart-pump-control` — destina-se a bombas existentes e a lavra não tem bomba registada.
Preços são estimativas de referência AGROGENIUS — confirmar com fornecedores locais.
Retorno do investimento: não calculado — faltam custos reais de rega e mão de obra.

```json
{
  "version": "rules-1.0.0",
  "recommendations": [
    {
      "projectSlug": "esp32-smart-irrigation",
      "score": 85,
      "rawScore": 85,
      "priority": "HIGH",
      "problem": "Desperdício de água",
      "reasons": [
        { "code": "PROBLEM_WATER_WASTE", "weight": 25, "text": "Declaraste \"Desperdício de água\" — este projeto atua diretamente sobre esse problema." },
        { "code": "GOAL_REDUCE_WATER", "weight": 15, "text": "Contribui para o teu objetivo \"Reduzir o consumo de água\"." },
        { "code": "GOAL_AUTOMATE_IRRIGATION", "weight": 15, "text": "Contribui para o teu objetivo \"Automatizar a irrigação\"." },
        { "code": "IRRIGATION_MANUAL", "weight": 15, "text": "A rega é manual em 5 ha: decidir quando regar com base na humidade real do solo evita regas desnecessárias." },
        { "code": "WATER_SOURCE_PUMPED", "weight": 5, "text": "A água vem de poço, o que limita o caudal disponível por dia." },
        { "code": "SOIL_CLAY", "weight": 5, "text": "Solo argiloso retém água durante mais tempo: regar por calendário tende a encharcar. Sensores evitam isso." },
        { "code": "OFFLINE_OK", "weight": 5, "text": "Funciona sem internet: decide localmente e envia dados quando houver ligação." },
        { "code": "BUDGET_PHASED", "weight": 0, "text": "O projeto completo (453 500 Kz) excede o orçamento, mas o piloto (255 500 Kz) cabe." }
      ],
      "bom": [
        { "name": "ESP32 DevKit V1", "spec": "Wi-Fi + Bluetooth, 38 pinos", "quantity": 1, "unitPriceKz": 12000, "totalKz": 12000, "optional": false },
        { "name": "Sensor capacitivo de humidade do solo v1.2", "spec": "Resistente à corrosão", "quantity": 8, "unitPriceKz": 4500, "totalKz": 36000, "optional": false, "note": "2 por zona × 4 zona(s)" },
        { "name": "Módulo de relés 4 canais 5 V", "spec": "Com optoacoplador", "quantity": 1, "unitPriceKz": 6500, "totalKz": 6500, "optional": false },
        { "name": "Relé de 1 canal (bomba)", "spec": null, "quantity": 1, "unitPriceKz": 2500, "totalKz": 2500, "optional": false },
        { "name": "Eletroválvula 12 V 1\" normalmente fechada", "spec": null, "quantity": 4, "unitPriceKz": 22000, "totalKz": 88000, "optional": false, "note": "1 por zona × 4 zona(s)" },
        { "name": "Boia de nível (proteção contra funcionamento a seco)", "spec": null, "quantity": 1, "unitPriceKz": 3500, "totalKz": 3500, "optional": false },
        { "name": "Bomba de superfície 0,5 cv", "spec": "Dimensionar conforme profundidade do poço", "quantity": 1, "unitPriceKz": 120000, "totalKz": 120000, "optional": false, "note": "Incluído porque não tens bomba de água registada" },
        { "name": "Cabo e tubagem por zona", "spec": "Cabo 3×0,75 mm² + ligações PVC", "quantity": 4, "unitPriceKz": 35000, "totalKz": 140000, "optional": false, "note": "1 por zona × 4 zona(s)" },
        { "name": "Filtro de rede 1\"", "spec": null, "quantity": 1, "unitPriceKz": 15000, "totalKz": 15000, "optional": false },
        { "name": "Módulo RTC DS3231", "spec": "Relógio para operar sem internet", "quantity": 1, "unitPriceKz": 3500, "totalKz": 3500, "optional": false },
        { "name": "Fonte de alimentação 12 V 5 A", "spec": "Entrada 220 V AC", "quantity": 1, "unitPriceKz": 9000, "totalKz": 9000, "optional": false },
        { "name": "Conversor DC-DC LM2596", "spec": "12 V → 5 V para o ESP32", "quantity": 1, "unitPriceKz": 2500, "totalKz": 2500, "optional": false },
        { "name": "Caixa de proteção IP65", "spec": "Policarbonato, com bucins", "quantity": 1, "unitPriceKz": 9000, "totalKz": 9000, "optional": false },
        { "name": "Módulo micro-SD + cartão 8 GB", "spec": "Registo local quando não há internet", "quantity": 1, "unitPriceKz": 6000, "totalKz": 6000, "optional": false },
        { "name": "Contactor 220 V 25 A", "spec": "Necessário para bombas > 0,5 cv", "quantity": 1, "unitPriceKz": 18000, "totalKz": 18000, "optional": true }
      ],
      "estimatedCostKz": 453500,
      "withinBudget": false,
      "phases": [
        { "name": "Fase 1 — Piloto numa zona", "description": "Instalar o controlador e uma zona completa para validar o funcionamento e medir resultados reais antes de expandir.", "costKz": 255500 },
        { "name": "Fase 2 — Expansão para 4 zonas", "description": "Replicar sensores e válvulas nas restantes zonas, reutilizando o mesmo controlador.", "costKz": 198000 }
      ],
      "roi": { "kind": "INSUFFICIENT_DATA", "missing": ["Custos de rega dos últimos 12 meses (água, combustível, energia)", "Custos de mão de obra dos últimos 12 meses"] },
      "warnings": [
        "A propriedade ainda não tem zonas registadas: assumimos 4 zona(s) de ~1.5 ha. Regista as zonas para um cálculo exato.",
        "Recomenda-se implementação faseada, começando pelo piloto."
      ]
    },
    { "projectSlug": "rain-gauge-alerts", "score": 60, "priority": "HIGH", "estimatedCostKz": 85500, "withinBudget": true },
    { "projectSlug": "automated-drip-irrigation", "score": 60, "priority": "HIGH", "estimatedCostKz": 4786000, "withinBudget": false }
  ],
  "excluded": [
    { "projectSlug": "smart-pump-control", "reason": "Destina-se a bombas existentes e a propriedade não tem bomba registada." },
    { "projectSlug": "soil-ph-monitoring", "reason": "Não responde a nenhum problema ou objetivo declarado para esta propriedade." }
  ],
  "missingData": ["Divisão da propriedade em zonas", "Registo de despesas de rega (para estimar retorno)"]
}
```

`estimatedCostKz` soma só as linhas com `optional: false`. O contactor (18 000 Kz) é opcional e fica de fora.

## 2. Da descrição para o `FarmProfile`

Usa só estes códigos (`packages/shared/src/domain.ts`):

| O agricultor diz | Campo | Código |
|---|---|---|
| poço / cacimba | waterSource | `WELL` |
| furo | waterSource | `BOREHOLE` |
| rio, riacho | waterSource | `RIVER` |
| lagoa | waterSource | `LAKE` |
| água da chuva, cisterna | waterSource | `RAINWATER` |
| água da rede / EPAL | waterSource | `MUNICIPAL` |
| barragem, represa | waterSource | `DAM` |
| não tenho água para regar | waterSource | `NONE` |
| balde, regador, mangueira à mão | irrigationSystem | `MANUAL` |
| sulcos, valas | irrigationSystem | `FURROW` |
| aspersores | irrigationSystem | `SPRINKLER` |
| gota-a-gota | irrigationSystem | `DRIP` |
| pivô | irrigationSystem | `PIVOT` |
| barro, terra pesada | soilType | `CLAY` / `CLAY_LOAM` |
| areia, terra solta | soilType | `SANDY` / `SANDY_LOAM` |
| terra vermelha | soilType | `LATERITIC` |
| não sei | soilType | `UNKNOWN` |
| "perde-se água" | problems | `WATER_WASTE` |
| "falta água", seca | problems | `DROUGHT` |
| chuva irregular | problems | `IRREGULAR_RAIN` |
| bichos, lagarta | problems | `PESTS` |
| doenças, fungos | problems | `DISEASES` |
| "colho pouco" | problems | `LOW_YIELD` |
| "gasto muito com trabalhadores" | problems | `HIGH_LABOR_COST` |
| calor que queima | problems | `HEAT_STRESS` |
| alagamentos | problems | `FLOODING` |
| "não sei o que se passa na lavra" | problems | `NO_DATA` |

Objetivos: `REDUCE_WATER`, `INCREASE_YIELD`, `MONITOR_SOIL`, `AUTOMATE_IRRIGATION`, `REDUCE_COSTS`,
`MONITOR_CLIMATE`, `PEST_CONTROL`. Internet: `NONE`, `LIMITED`, `GOOD`. A província tem de ser uma das de
`ANGOLA_PROVINCES`. O clima vem de `PROVINCE_CLIMATE` (Namibe `ARID`; Cunene, Benguela, Luanda `SEMI_ARID`;
Huambo, Bié, Huíla `HIGHLAND`).

## 3. Regras de cálculo (iguais às do motor)

**Exclusões** (o projeto sai, com motivo):
- `requires: WATER_SOURCE` e `waterSource = NONE`.
- `requires: PUMP` e `hasPumps = false` (`smart-pump-control`).
- `requires: GRID_ELECTRICITY` e `hasElectricity = false` (`smart-pump-control`, `energy-monitoring`).
- `worksOffline = false` e `internet = NONE` (`pest-detection-vision`).
- Projeto com `drip` no slug e rega por `PIVOT`.
- Nenhum problema em `solves` nem nenhum objetivo em `supportsGoals`.

**Pontuação** (soma dos pesos, limitada a 0–100; abaixo de 20 é excluído):
- +25 por problema declarado que o projeto resolve; +15 por objetivo que suporta.
- Projetos que controlam a rega: +15 rega `MANUAL`/`NONE`; +8 `FURROW`; +10 cultura com `waterNeed: HIGH`;
  +10 água `SCARCE`/`SEASONAL`; +5 poço ou furo; +5 solo argiloso; +5 solo arenoso.
- +8 clima árido/semiárido (projetos de água e de clima); +5 planalto (projetos de clima).
- Projetos de solo: +10 solo `UNKNOWN`; −10 se já há sensores. Gestão de recursos com bombas: +10.
- +5 funciona sem internet e a internet não é `GOOD`; −10 precisa de internet e ela é `LIMITED`.
- −5 se o projeto precisa de eletricidade e a lavra não a tem; −10 se a dificuldade (BEGINNER 0,5 · INTERMEDIATE 1,5 · ADVANCED 2,5) excede o `techLevel` (NONE 0 · BASIC 1 · INTERMEDIATE 2 · ADVANCED 3) em mais de 1; senão +5 se é `BEGINNER`.
- Orçamento: +5 cabe; 0 se só o piloto cabe; −25 se nem o piloto cabe.

**Prioridade:** `CRITICAL` se a pontuação ≥ 85, seca ou desperdício de água declarados, água `SCARCE` e projeto de água; `HIGH` ≥ 60; `MEDIUM` ≥ 35;
`LOW` abaixo disso. Ordena por `rawScore` (antes do limite de 100); em empate, ganha o projeto mais barato.

**Zonas:** se não há zonas registadas, `ceil(área cultivada / 1,5 ha)`, entre 1 e 8.

**Lista de materiais:** cada componente do catálogo entra se a sua `condition` se cumprir:
- `NO_PUMP`: sem bomba.
- `NO_ELECTRICITY`: painel solar 50 W, bateria 20 Ah e controlador de carga.
- `HAS_ELECTRICITY`: fonte 12 V.
- `NO_INTERNET`: micro-SD, quando a internet não é `GOOD`.

Quantidades: `FIXED`, `PER_ZONE` (× zonas) ou `PER_HECTARE` (× ha, arredondado para cima), com
`maxQuantity` como teto.

**Fases:** só existem se houver mais de 1 zona e o piloto (uma zona de 1,5 ha) custar menos do que o total.

**ROI:** só para projetos de água (`SMART_IRRIGATION`, `RESOURCE_MANAGEMENT`) e só com custos registados.
Poupança anual = 20 % dos custos de rega + 15 % × 50 % da mão de obra. Sem esses custos, `INSUFFICIENT_DATA`.

## 4. Exemplos completos

### Exemplo 1 — Huambo, 5 ha de milho

É o exemplo completo da secção 1. É também o caso que o `engine.spec.ts` protege; se a sugestão não der
`esp32-smart-irrigation` com 85/100 e 453 500 Kz, as regras foram mal aplicadas.

### Exemplo 2 — Namibe, horta de tomate sem eletricidade e orçamento baixo

**Descrição:** "Tenho meio hectare de tomate no Namibe, perto do rio. A terra é arenosa e a água está cada vez
mais escassa, a seca está forte e rego com baldes, perde-se muita água. Lá não chega luz nem rede de telemóvel.
Nunca usei estas tecnologias. Tenho 150 mil Kz."

**Perfil entendido:** província Namibe (`ARID`); 0,5 ha de tomate (`waterNeed: HIGH`); `SANDY`; `RIVER`;
`MANUAL`; `waterAvailability: SCARCE`; `hasElectricity: false`; `internet: NONE`; `techLevel: NONE`;
`hasPumps: false` (assumido); orçamento 150 000 Kz; problemas `DROUGHT`, `WATER_WASTE`; objetivo
`REDUCE_WATER` (assumido a partir de "perde-se muita água"); 1 zona.

**Sugestões**

### 1. Irrigação inteligente com ESP32 (`esp32-smart-irrigation`) — 78/100 · prioridade ALTA
**Problema que resolve:** Seca / falta de água
**Porquê nesta lavra:** seca e desperdício de água declarados; tomate pede muita água; solo arenoso drena
depressa; Namibe é árido; funciona sem internet.
**Custo estimado:** 358 500 Kz — não cabe no orçamento de 150 000 Kz. Com uma só zona não há fases.
**Atenção:** inclui alimentação solar (112 000 Kz) e bomba (120 000 Kz); recomenda-se acompanhamento de um técnico.

### 2. Gota-a-gota automatizado (`automated-drip-irrigation`) — 78/100 · prioridade ALTA
**Custo estimado:** 1 209 500 Kz — não cabe no orçamento.

### 3. Monitorização do consumo de água (`water-consumption-monitoring`) — 58/100 · prioridade MÉDIA
**Custo estimado:** 153 500 Kz — fica 3 500 Kz acima do orçamento.

**Nenhuma sugestão cabe nos 150 000 Kz.** Diz isso claramente e indica o que muda a conta (ver secção 5).
**O que falta saber:** divisão em zonas; registo de despesas de rega.
**Projetos excluídos:** `smart-pump-control` (sem bomba registada).
Preços são estimativas de referência AGROGENIUS — confirmar com fornecedores locais.
Retorno do investimento: não calculado — faltam custos reais de rega e mão de obra.

```json
{
  "version": "rules-1.0.0",
  "recommendations": [
    {
      "projectSlug": "esp32-smart-irrigation",
      "score": 78,
      "rawScore": 78,
      "priority": "HIGH",
      "problem": "Seca / falta de água",
      "reasons": [
        { "code": "PROBLEM_DROUGHT", "weight": 25, "text": "Declaraste \"Seca / falta de água\" — este projeto atua diretamente sobre esse problema." },
        { "code": "PROBLEM_WATER_WASTE", "weight": 25, "text": "Declaraste \"Desperdício de água\" — este projeto atua diretamente sobre esse problema." },
        { "code": "GOAL_REDUCE_WATER", "weight": 15, "text": "Contribui para o teu objetivo \"Reduzir o consumo de água\"." },
        { "code": "IRRIGATION_MANUAL", "weight": 15, "text": "A rega é manual em 0.5 ha: decidir quando regar com base na humidade real do solo evita regas desnecessárias." },
        { "code": "CROP_HIGH_WATER", "weight": 10, "text": "Tomate tem elevada necessidade de água." },
        { "code": "WATER_LIMITED", "weight": 10, "text": "A disponibilidade de água é escassa: cada litro poupado conta." },
        { "code": "CLIMATE_DRY", "weight": 8, "text": "Namibe está numa zona de clima seco/semiárido (classificação regional aproximada)." },
        { "code": "SOIL_SANDY", "weight": 5, "text": "Solo arenoso drena depressa: regas curtas e frequentes, controladas por sensor, reduzem perdas." },
        { "code": "OFFLINE_OK", "weight": 5, "text": "Funciona sem internet: decide localmente e envia dados quando houver ligação." },
        { "code": "NO_ELECTRICITY", "weight": -5, "text": "Sem eletricidade: a lista inclui alimentação solar, o que aumenta o custo." },
        { "code": "SKILL_GAP", "weight": -10, "text": "Complexidade intermédio face a um nível tecnológico nenhuma." },
        { "code": "BUDGET_OVER", "weight": -25, "text": "Custo estimado 358 500 Kz excede o orçamento de 150 000 Kz." }
      ],
      "bom": [
        { "name": "ESP32 DevKit V1", "spec": "Wi-Fi + Bluetooth, 38 pinos", "quantity": 1, "unitPriceKz": 12000, "totalKz": 12000, "optional": false },
        { "name": "Sensor capacitivo de humidade do solo v1.2", "spec": "Resistente à corrosão", "quantity": 2, "unitPriceKz": 4500, "totalKz": 9000, "optional": false, "note": "2 por zona × 1 zona(s)" },
        { "name": "Módulo de relés 4 canais 5 V", "spec": "Com optoacoplador", "quantity": 1, "unitPriceKz": 6500, "totalKz": 6500, "optional": false },
        { "name": "Relé de 1 canal (bomba)", "spec": null, "quantity": 1, "unitPriceKz": 2500, "totalKz": 2500, "optional": false },
        { "name": "Eletroválvula 12 V 1\" normalmente fechada", "spec": null, "quantity": 1, "unitPriceKz": 22000, "totalKz": 22000, "optional": false, "note": "1 por zona × 1 zona(s)" },
        { "name": "Boia de nível (proteção contra funcionamento a seco)", "spec": null, "quantity": 1, "unitPriceKz": 3500, "totalKz": 3500, "optional": false },
        { "name": "Bomba de superfície 0,5 cv", "spec": "Dimensionar conforme profundidade do poço", "quantity": 1, "unitPriceKz": 120000, "totalKz": 120000, "optional": false, "note": "Incluído porque não tens bomba de água registada" },
        { "name": "Cabo e tubagem por zona", "spec": "Cabo 3×0,75 mm² + ligações PVC", "quantity": 1, "unitPriceKz": 35000, "totalKz": 35000, "optional": false, "note": "1 por zona × 1 zona(s)" },
        { "name": "Filtro de rede 1\"", "spec": null, "quantity": 1, "unitPriceKz": 15000, "totalKz": 15000, "optional": false },
        { "name": "Módulo RTC DS3231", "spec": "Relógio para operar sem internet", "quantity": 1, "unitPriceKz": 3500, "totalKz": 3500, "optional": false },
        { "name": "Conversor DC-DC LM2596", "spec": "12 V → 5 V para o ESP32", "quantity": 1, "unitPriceKz": 2500, "totalKz": 2500, "optional": false },
        { "name": "Caixa de proteção IP65", "spec": "Policarbonato, com bucins", "quantity": 1, "unitPriceKz": 9000, "totalKz": 9000, "optional": false },
        { "name": "Painel solar 50 W", "spec": null, "quantity": 1, "unitPriceKz": 45000, "totalKz": 45000, "optional": false, "note": "Alimentação solar: não há eletricidade na propriedade" },
        { "name": "Bateria 12 V 20 Ah (gel)", "spec": null, "quantity": 1, "unitPriceKz": 55000, "totalKz": 55000, "optional": false, "note": "Alimentação solar: não há eletricidade na propriedade" },
        { "name": "Controlador de carga solar PWM 10 A", "spec": null, "quantity": 1, "unitPriceKz": 12000, "totalKz": 12000, "optional": false, "note": "Alimentação solar: não há eletricidade na propriedade" },
        { "name": "Módulo micro-SD + cartão 8 GB", "spec": "Registo local quando não há internet", "quantity": 1, "unitPriceKz": 6000, "totalKz": 6000, "optional": false },
        { "name": "Contactor 220 V 25 A", "spec": "Necessário para bombas > 0,5 cv", "quantity": 1, "unitPriceKz": 18000, "totalKz": 18000, "optional": true }
      ],
      "estimatedCostKz": 358500,
      "withinBudget": false,
      "phases": [],
      "roi": { "kind": "INSUFFICIENT_DATA", "missing": ["Custos de rega dos últimos 12 meses (água, combustível, energia)", "Custos de mão de obra dos últimos 12 meses"] },
      "warnings": [
        "Recomenda-se acompanhamento de um técnico na instalação.",
        "A propriedade ainda não tem zonas registadas: assumimos 1 zona(s) de ~1.5 ha. Regista as zonas para um cálculo exato."
      ]
    },
    { "projectSlug": "automated-drip-irrigation", "score": 78, "priority": "HIGH", "estimatedCostKz": 1209500, "withinBudget": false },
    { "projectSlug": "water-consumption-monitoring", "score": 58, "priority": "MEDIUM", "estimatedCostKz": 153500, "withinBudget": false }
  ],
  "excluded": [
    { "projectSlug": "smart-pump-control", "reason": "Destina-se a bombas existentes e a propriedade não tem bomba registada." }
  ],
  "missingData": ["Divisão da propriedade em zonas", "Registo de despesas de rega (para estimar retorno)"]
}
```

## 5. Casos-limite

**Descrição incompleta.** Sem província, área, cultura, fonte de água ou energia, não sugiras nada: faz
uma pergunta curta com os campos em falta. Exemplo: *"Para dimensionar, preciso de saber: em que província
fica a lavra, quantos hectares cultivas e de onde vem a água?"* Campos secundários (solo, internet,
nível tecnológico) podem ser assumidos, mas aparecem como "assumido" no perfil e em "O que falta saber".
Sem orçamento, continua com `budgetKz: null` e escreve que a viabilidade financeira não foi verificada.

**Lavra sem energia da rede.** Põe `hasElectricity: false`. A lista inclui automaticamente painel solar
50 W, bateria 12 V 20 Ah e controlador de carga (112 000 Kz no total) e retira a fonte 220 V. Exclui
`smart-pump-control` e `energy-monitoring`. Diz ao agricultor quanto do custo é a parte solar.

**Orçamento baixo.** Nunca baixes preços nem retires componentes obrigatórios para caber. Mostra o custo
real, `withinBudget: false`, e as fases se existirem. Se nada couber (como no exemplo 2), diz isso e aponta
o que muda a conta: já ter bomba (−120 000 Kz na rega inteligente), um projeto mais simples que responda
ao mesmo problema, ou começar por uma parte da área.

**Peças difíceis de encontrar em Angola.** O catálogo não regista a disponibilidade local, por isso não
afirmes que uma peça existe ou não existe no mercado, nem indiques lojas. Se o agricultor disser que não
encontra uma peça, mantém-na na lista e acrescenta em `warnings` "Confirmar disponibilidade com fornecedores
locais antes de comprar". Se houver no catálogo outro projeto que resolva o mesmo problema sem essa peça,
sugere-o como alternativa.

**Preço desconhecido.** Só há preços para os componentes de `catalog/prices.ts`. Se o agricultor pedir algo
fora do catálogo (drones, por exemplo, que não existem no catálogo), não inventes valor nem projeto: diz que
não faz parte do catálogo AGROGENIUS, deixa o preço como "desconhecido — pedir cotação" e sugere o projeto do
catálogo mais próximo (`crop-monitoring-camera` ou `pest-detection-vision` para vigiar a cultura).
