# AGROGENIUS — Arquitetura

> Documento vivo. Regista as decisões técnicas e o porquê de cada uma.

## 1. Visão geral

```
                    ┌──────────────────────────────┐
  Browser / PWA ──► │  apps/web  (Next.js 15)       │  SSR + RSC, R3F (3D), MapLibre
  (offline queue)   │  TanStack Query, RHF + Zod    │
                    └──────────────┬───────────────┘
                                   │ REST (JWT) + WebSocket (socket.io)
                    ┌──────────────▼───────────────┐
                    │  apps/api  (NestJS 11)        │  módulos por domínio, Swagger
                    │  RBAC · Audit · Rate limit    │
                    │  Recommendation Engine (puro) │
                    │  Automation Engine + Safety   │
                    └───┬───────────┬──────────┬───┘
                        │           │          │
                 PostgreSQL     Redis       MQTT broker (EMQX/Mosquitto)
                 (Prisma)    (cache/filas)      ▲
                                                │ TLS + credenciais por dispositivo
                                         ESP32 (firmware/esp32)
                                         lógica local de irrigação (funciona offline)
```

**Monorepo npm workspaces** (`apps/*`, `packages/*`). O pnpm/turbo não estão instalados no ambiente
e o ganho não justifica a dependência adicional nesta fase.

## 2. Decisões e justificações

| Decisão | Porquê | Alternativa rejeitada |
|---|---|---|
| **NestJS** no backend | Módulos, DI, guards e pipes dão-nos RBAC, validação e auditoria de forma uniforme em 15 domínios. | Express "cru": acabaria por reinventar a mesma estrutura. |
| **Next.js App Router** | SSR para a landing (SEO), RSC, layouts aninhados para o dashboard. | SPA Vite: pior SEO e sem layouts de servidor. |
| **Prisma + PostgreSQL** | Tipos gerados, migrações versionadas, relacional encaixa no domínio (propriedades → zonas → plantações → colheitas). | Mongo: o domínio é fortemente relacional. |
| **Geografia em GeoJSON (JSONB) + lat/lng** | Funciona em qualquer Postgres, incluindo o embutido usado em dev sem Docker. As geometrias são pequenas (polígonos de propriedades). | PostGIS obrigatório desde o dia 1: bloquearia o desenvolvimento local. **Plano:** em produção a imagem `postgis/postgis` é usada; uma migração SQL adiciona colunas `geometry` geradas a partir do JSONB quando forem necessárias consultas espaciais (ex.: "sensores dentro da zona", NDVI por polígono). |
| **Motor de recomendações baseado em regras, determinístico** | Explicável (cada recomendação lista as razões), testável, funciona sem API externa e sem dados de treino que ainda não existem. A interface `RecommendationEngine` permite trocar/juntar um modelo ML mais tarde. | LLM a gerar recomendações: não é reprodutível e pode inventar custos. |
| **Agro AI = LLM com contexto restrito (RAG leve)** | O LLM só recebe o perfil da propriedade autorizada + recomendações do motor + catálogo. Não gera números novos: cita os do motor. Sem chave de API → modo "baseado em regras" claramente identificado. | — |
| **MQTT** para IoT | Leve, tolera ligações fracas, QoS, *retained messages*, padrão do setor. | HTTP polling: consome mais bateria e dados móveis. |
| **Segurança de comandos no servidor E no firmware** | O servidor valida (tempo máximo, proteção contra funcionamento a seco, *cooldown*); o ESP32 aplica limites próprios mesmo que receba um comando inválido. | Confiar só num dos lados. |
| **Redis** | Cache, filas (BullMQ) para relatórios PDF e notificações. Opcional em dev: sem `REDIS_URL` as filas correm em processo. | — |
| **Valores monetários em `Decimal` + `currency`** | Kz como moeda base, preparado para multi-moeda. | `float`: erros de arredondamento. |
| **Tailwind + componentes estilo shadcn (copiados para o repo)** | Controlo total do design; sem aspeto de template. | Biblioteca de componentes fechada. |

## 3. Multi-tenancy

- `Organization` é o tenant. Um agricultor individual tem uma organização própria (criada no registo);
  uma cooperativa tem vários utilizadores e várias propriedades.
- Todos os dados de negócio pertencem a uma `Farm`, e cada `Farm` pertence a uma `Organization`.
- **Regra de acesso** (`FarmAccessService`):
  - `ADMIN`: tudo.
  - `FARMER`: propriedades da sua organização.
  - `TECHNICIAN`: apenas propriedades com `TechnicianAssignment` ativo.
- O isolamento é aplicado num único ponto (serviço de acesso) e não espalhado pelos controladores.

## 4. Modelo de dados (resumo)

Ver `apps/api/prisma/schema.prisma` para o esquema completo.

```
Organization 1─* User
Organization 1─* Farm 1─* Field (zona)
Farm 1─* Planting *─1 Crop (catálogo)
Planting 1─* CropActivity (fertilizante, tratamento…) · 1─* Harvest
Farm 1─* Transaction (despesa/receita, Decimal + moeda)
Farm 1─* Device 1─* Sensor 1─* SensorReading
             Device 1─* Actuator 1─* Command
Farm 1─* AutomationRule (sensor → atuador, limites, segurança)
Project (biblioteca AgroTech Lab) 1─* ProjectComponent
Farm 1─* Recommendation *─1 Project   (gerada pelo motor ou por técnico)
Farm 1─* FarmProject (implementação real de um projeto)
User *─* Project (Favorite)
User 1─* Notification · AuditLog · AiConversation 1─* AiMessage
User *─* Farm (TechnicianAssignment)
```

## 5. Estrutura de pastas

```
agrogenius/
├─ apps/
│  ├─ api/                     NestJS
│  │  ├─ prisma/               schema, migrações, seed (catálogo de culturas e projetos)
│  │  └─ src/
│  │     ├─ common/            guards, decorators, filtros de erro, interceptors (auditoria)
│  │     ├─ prisma/            PrismaService
│  │     └─ modules/
│  │        ├─ auth/  users/  farms/  fields/  crops/  production/
│  │        ├─ devices/  sensors/  automations/  mqtt/
│  │        ├─ recommendations/   (engine/ = lógica pura e testada)
│  │        ├─ projects/  ai/  finance/  notifications/  reports/  audit/
│  └─ web/                     Next.js
│     └─ src/
│        ├─ app/               rotas (marketing), (auth), (app)
│        ├─ components/        ui/ (design system), three/, maps/, charts/
│        ├─ features/          lógica por domínio (hooks TanStack Query)
│        └─ lib/               api client, auth, offline queue
├─ packages/
│  └─ shared/                  enums, schemas Zod e tipos partilhados API ↔ Web
├─ firmware/esp32/             código Arduino/ESP-IDF de referência
├─ docs/                       arquitetura, API, IoT, deploy
└─ docker-compose.yml          postgis, redis, mosquitto
```

## 6. Funcionamento offline

1. **Web (PWA):** service worker para a *app shell*; operações essenciais (registar atividade,
   despesa, colheita) entram numa fila em IndexedDB com `clientId` (UUID) e são reenviadas quando
   há rede. O backend aceita `clientId` como chave de idempotência, para que o reenvio não duplique registos.
2. **Campo:** o ESP32 decide a irrigação localmente com os limites da última configuração recebida
   (guardada em NVS). Leituras são guardadas em buffer e enviadas quando a ligação volta.

## 7. Segurança

- JWT de acesso curto (15 min) + refresh token rotativo (hash em BD, revogável, deteção de reutilização).
- Palavras-passe com argon2id.
- RBAC por decorator `@Roles()` + verificação de acesso à propriedade.
- `ValidationPipe` global (whitelist + forbidNonWhitelisted).
- Rate limiting global (`@nestjs/throttler`), mais restrito em `/auth`.
- Auditoria de mutações (`AuditLog`).
- Dispositivos IoT: credenciais MQTT únicas por dispositivo (segredo mostrado uma vez, guardado em hash),
  ACL por tópico `agrogenius/{deviceId}/#`.

## 8. Dados de demonstração

- O seed cria o **catálogo** (culturas, projetos da biblioteca, preços de referência). Os preços são
  **estimativas de referência** (campo `priceSource`, data de referência) e a interface mostra-os como tal.
- Uma conta de demonstração opcional (`npm run seed:demo`) cria uma propriedade marcada com `isDemo = true`;
  a interface mostra a etiqueta "Dados de demonstração".
- Nunca são geradas leituras de sensores falsas fora do modo demo/simulador explícito.

## 9. Plano de desenvolvimento

| Fase | Conteúdo | Estado |
|---|---|---|
| 1 | Arquitetura, modelo de dados, esquema, estrutura | ✅ |
| 2 | Design system, layout, navegação, globo 3D, dashboard | em curso |
| 3 | Auth, onboarding, propriedades, zonas, culturas, finanças | em curso |
| 4 | Motor de recomendações, AgroTech Lab, Agro AI | motor + biblioteca em curso |
| 5 | IoT: dispositivos, MQTT, leituras, regras, comandos seguros | por fazer |
| 6 | PDF, notificações, testes, segurança, deploy | por fazer |
