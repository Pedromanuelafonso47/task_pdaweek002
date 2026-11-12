# AGROGENIUS — Intelligent Agriculture Platform

Plataforma de gestão agrária, agricultura de precisão e automação IoT, pensada para Angola.

**Diferencial:** analisa cada propriedade (localização, solo, água, culturas, infraestrutura, orçamento, custos reais)
e recomenda projetos IoT **dimensionados e orçamentados para essa propriedade**. Cada recomendação explica as suas razões,
mostra a lista de materiais, propõe uma implementação faseada quando o orçamento não chega e só calcula o retorno do
investimento quando existem dados reais para isso.

## Arranque rápido (Windows/macOS/Linux, sem Docker)

```bash
npm install
npm run db:start                         # terminal 1 — PostgreSQL embutido (porta 54329)

cd apps/api
cp .env.example .env                     # já existe em dev
npx prisma migrate deploy
ADMIN_PASSWORD='AgroAdmin2026!' npm run db:seed   # catálogo (20 culturas, 18 projetos) + administrador
npm run seed:demo                        # opcional: conta demo@agrogenius.ao / Demo2026! (dados fictícios, marcados como demo)
cd ../..
npm run build -w @agrogenius/shared
npm run dev:api                          # terminal 2 — http://localhost:4000/api · Swagger: /api/docs
npm run dev:web                          # terminal 3 — http://localhost:3000
```

Com Docker: `docker compose up -d` (PostGIS + Redis + Mosquitto) e as mesmas variáveis.

## Testes

```bash
npm test                                 # unitários: motor de recomendações + regras de segurança IoT
npm run test:smoke -w @agrogenius/api    # 42 verificações de ponta a ponta contra a API em execução
npm run typecheck
```

## Estrutura

```
apps/api      NestJS 11 · Prisma · PostgreSQL · Socket.IO · MQTT · PDFKit · Anthropic SDK
apps/web      Next.js 15 · React 19 · Tailwind · Radix · TanStack Query · RHF+Zod · R3F · MapLibre · Recharts
packages/shared   enums, rótulos PT e schemas Zod partilhados (validação idêntica no cliente e no servidor)
firmware/esp32    firmware de referência (irrigação multi-zona com segurança local)
docs/             ARCHITECTURE · IOT · DEPLOY · NOTIFICATIONS
```

## Módulos

| Módulo | Estado |
|---|---|
| Autenticação JWT + refresh rotativo (cookie httpOnly, deteção de reutilização), RBAC (Agricultor/Técnico/Admin), multi-tenant | ✅ |
| Onboarding em 5 etapas com rascunho no servidor → perfil agrícola estruturado | ✅ |
| Propriedades, zonas (GeoJSON), histórico, técnicos autorizados | ✅ |
| Culturas, plantações, atividades, colheitas, calendário, produtividade | ✅ |
| Finanças em Kz (multi-moeda preparada), lucro por cultura, custo/ha | ✅ |
| Motor de recomendações (regras explicáveis, BOM dimensionada, faseamento, ROI só com dados) | ✅ testado |
| AgroTech Lab: 18 projetos, 5 categorias, pesquisa, filtros, favoritos, comparação, firmware | ✅ |
| AgroControl: dispositivos, credenciais por dispositivo, MQTT + HTTP, leituras, regras, comandos seguros | ✅ testado |
| Agro AI: Claude (`claude-opus-5-5`) com contexto restrito à propriedade; modo de regras sem chave | ✅ |
| Notificações in-app em tempo real + lembretes de colheita e manutenção | ✅ |
| Relatórios PDF (7 tipos) com identidade visual | ✅ |
| Offline: fila IndexedDB + idempotência por `clientId` | ✅ |

## O que depende de configuração externa

| Item | O que falta |
|---|---|
| Broker MQTT | `MQTT_URL` (sem ele, IoT funciona por HTTP) — `docs/IOT.md` |
| Hardware | ESP32 + sensores; usar `npm run iot:simulate` para testar sem hardware |
| Agro AI generativo | `ANTHROPIC_API_KEY` (sem ela, modo baseado em regras, identificado na interface) |
| SMS / email / WhatsApp | credenciais de fornecedor — interface `NotificationChannel` pronta |
| Fotografias (S3/Cloudinary) | credenciais de armazenamento; campo `Farm.photos` existe |
| Imagens de satélite / NDVI | fornecedor de imagens; arquitetura e migração PostGIS documentadas |

## Skill do Claude Code

A skill [`agrotech`](.claude/skills/agrotech/) transforma a descrição que um agricultor faz da lavra em
sugestões de projetos IoT do catálogo, com as mesmas regras e preços de referência do motor. O teste de
disparo está em [docs/evidencia-skill.md](docs/evidencia-skill.md).

## Honestidade dos dados

- Preços dos componentes: **estimativas de referência** (`apps/api/src/modules/projects/catalog/prices.ts`), sempre rotuladas como tal.
- Parâmetros das culturas: referências agronómicas gerais (FAO-56), a ajustar localmente.
- Leituras de sensores: só vêm de dispositivos reais, do simulador explícito, ou da conta demo (marcada `isDemo`).
- Retorno do investimento: calculado apenas com custos reais registados, com pressupostos explícitos.
