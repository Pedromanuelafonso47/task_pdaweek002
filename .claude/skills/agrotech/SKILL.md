---
name: agrotech
description: Transforma a descrição que um agricultor angolano faz da sua lavra (província, cultura, hectares, fonte de água, rega, energia, orçamento em Kz) num perfil FarmProfile e sugere projetos IoT agrícolas do catálogo AGROGENIUS — rega automática, sensores de solo, estação meteorológica, câmaras — com razões, lista de materiais e preços de referência. Use quando alguém descrever uma lavra, fazenda ou horta em Angola e pedir que tecnologia, automação, rega inteligente ou sensores instalar. Não use para IoT doméstico, casa inteligente ou projetos fora da agricultura.
allowed-tools: Read, Grep, Glob
---

# Sugerir projeto IoT para uma lavra

## O que ela faz

Lê a descrição livre de uma lavra em Angola, converte-a no `FarmProfile` que o motor do AGROGENIUS usa e
sugere até 3 projetos do catálogo da AgroTech Lab, cada um com as razões, a lista de materiais
dimensionada, o custo estimado em Kz e o que falta saber. Aplica as mesmas regras do motor
(`apps/api/src/modules/recommendations/engine/engine.ts`): sem razão ligada a um problema ou objetivo
declarado, o projeto não entra.

## Quando ela dispara (e quando não deveria)

Dispara quando alguém descreve uma propriedade agrícola e quer saber que tecnologia montar.

- Dispara: "Tenho 2 hectares de tomate no Cuanza Sul, rego com balde a partir de um rio e tenho 200 mil Kz. Que sistema automático me aconselhas?"
- Não dispara: "Quero automatizar a rega do jardim e as luzes da minha casa em Luanda com um ESP32." É IoT doméstico, não uma lavra.

Também não serve para mexer no código do motor, criar projetos novos no catálogo ou depurar a API.

## Passos

1. Extrai da descrição os campos do `FarmProfile` (`engine/types.ts`), usando só os valores de `packages/shared/src/domain.ts`.
2. Se faltar um campo obrigatório (província, área, cultura, fonte de água, energia), pergunta antes de continuar. Não inventes.
3. Lê `apps/api/src/modules/projects/catalog/catalog.ts` e elimina os projetos cujos `requires` a lavra não cumpre.
4. Fica só com os projetos cujo `solves` ou `supportsGoals` coincide com um problema ou objetivo declarado.
5. Calcula zonas, lista de materiais e custo com as regras e os preços de `catalog/prices.ts`, como está em [reference.md](reference.md).
6. Ordena pela pontuação, escolhe até 3 e compara o custo com o orçamento (fases, se não couber).
7. Responde no formato do reference.md: resumo para o agricultor e bloco JSON compatível com `EngineRecommendation`.

## Exemplo de invocação

> "Um agricultor do Cuanza Sul tem 2 hectares de tomate, tira água do rio com baldes e não tem luz na lavra. Tem uns 250 mil kwanzas. O que é que lhe recomendamos montar para regar melhor?"

Resultado real (teste de 12/11/2026, conferido com `recommend()`): a skill disparou sozinha, marcou o objetivo
como assumido e os problemas como em falta, e concluiu que nada cabe nos 250 000 Kz. A rega inteligente com
ESP32 fica excluída com 15/100 (piloto de 358 500 Kz, dos quais 232 000 são bomba e kit solar). Em vez de
inventar, pergunta se se perde água: com esse problema declarado, `soil-moisture-network` sobe para 65/100 e
180 500 Kz, dentro do orçamento.

Para o formato exato de saída, veja [reference.md](reference.md).
