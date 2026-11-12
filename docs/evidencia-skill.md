# Evidência — skill `agrotech`

Teste feito a 12/11/2026 com Claude Code 2.1.322, na raiz do repositório.

## Método

Cada frase foi enviada numa sessão nova e limpa: `claude -p "<frase>" --output-format stream-json --verbose`,
o equivalente a correr `/clear` antes de cada pedido. O registo JSON de cada sessão mostra que ferramentas o
Claude chamou. A skill conta como disparada quando aparece uma chamada `Skill(agrotech)`. As sessões só tinham
ferramentas de leitura (`Read`, `Grep`, `Glob`, `Skill`), por isso nenhum teste alterou ficheiros do projeto.
Nas três sessões, a skill `agrotech` aparecia na lista de skills disponíveis.

## Resultados

| | Frase | Esperado | Resultado | Ferramentas chamadas |
|---|---|---|---|---|
| (b) | "Porque é que o nest build está a deixar a pasta dist incompleta?" | não dispara | **não disparou** ✔ | Glob, Read (tsconfig, nest-cli), Grep |
| (c) | "Quero automatizar a rega do jardim e ligar sensores de humidade às plantas da varanda do meu apartamento em Luanda, com um ESP32 e alertas no telemóvel." | não dispara (falso positivo: IoT doméstico) | **não disparou** ✔ | Glob, Read (firmware ESP32) |
| (a) | "Um agricultor do Cuanza Sul tem 2 hectares de tomate, tira água do rio com baldes e não tem luz na lavra. Tem uns 250 mil kwanzas. O que é que lhe recomendamos montar para regar melhor?" | dispara | **disparou** ✔ | **Skill(agrotech)** na primeira chamada; depois Read de `reference.md`, `catalog.ts`, `prices.ts`, `engine.ts`, `types.ts` |

## Progressive disclosure (tokens de contexto)

Os números vêm do campo `usage` de cada chamada à API (tokens de entrada, mais cache lida, mais cache
criada). É a mesma grandeza que o `/context` mostra, mas medida em modo não interativo.

| Momento do teste (a) | Contexto |
|---|---|
| Antes de a skill disparar (só a description está carregada) | **29 120** tokens |
| Depois de carregar o `SKILL.md` | 34 145 tokens |
| Depois de ler o `reference.md` e os ficheiros do catálogo | **83 522** tokens |

Para comparar, as sessões (b) e (c) começaram com 29 059 e 26 870 tokens. A description da skill está sempre
carregada e custa pouco mais de cem tokens. O corpo do `SKILL.md` e o `reference.md` só entram quando a skill
dispara, e por isso a sessão (a) passou de cerca de 29 mil para 83 mil tokens. Nas sessões (b) e (c) o
`SKILL.md` e o `reference.md` nunca foram carregados.

## Conferência da resposta de (a)

A resposta seguiu o formato do `reference.md`: perfil entendido, com o que foi dito e o que foi assumido,
sugestões, bloco JSON e as frases obrigatórias sobre preços e ROI. A skill fez as contas à mão; corri o motor
real (`recommend()`) com o mesmo perfil e os resultados coincidem:

- `esp32-smart-irrigation` e `automated-drip-irrigation` ficam excluídos com 15/100.
- Se o agricultor declarar desperdício de água, `soil-moisture-network` sobe para 65/100, prioridade alta,
  180 500 Kz, dentro do orçamento.

A skill também apontou um problema real no catálogo: sem eletricidade, a lista junta um painel de 50 W, mas
inclui uma bomba de superfície de 220 V que esse painel não alimenta. Ficou registado para corrigir depois e
não foi alterado neste entregável.
