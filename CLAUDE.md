# CLAUDE.md

AGROGENIUS é uma plataforma de gestão agrária para Angola. O coração do produto é o motor que olha para uma
propriedade concreta e recomenda projetos IoT dimensionados e orçamentados para ela. Escreve sempre em
português de Angola (interface, mensagens de erro, comentários).

## Como está organizado

- `apps/api` — NestJS + Prisma. Um módulo por domínio em `src/modules/`.
- `apps/web` — Next.js (App Router). Páginas em `src/app/(app)/`, lógica de cada área em `src/features/`.
- `packages/shared` — enums, rótulos PT e schemas Zod usados **tanto** pela API como pela web.
  Se mudares um schema, muda-o aqui e não dupliques validação noutro sítio.
- `firmware/esp32` — firmware de referência; o seed lê-o para a AgroTech Lab.

## Pôr a correr

Nesta máquina não há Docker nem PostgreSQL instalado.

```bash
npm run db:start                          # PostgreSQL embutido na porta 54329 (deixa este terminal aberto)
npm run build -w @agrogenius/shared       # obrigatório antes da API e da web
npm run dev:api                           # http://localhost:4000/api  (Swagger em /api/docs)
npm run dev:web                           # http://localhost:3000
```

Contas: `demo@agrogenius.ao / Demo2026!` (dados fictícios) e `admin@agrogenius.ao / AgroAdmin2026!`.

## Antes de dares algo por terminado

```bash
npm test                                  # motor de recomendações + segurança IoT
node apps/api/scripts/smoke.mjs           # 42 verificações contra a API a correr
npm run typecheck
```

## Regras que não se negoceiam

- **Nada de dados falsos apresentados como reais.** Preços são "estimativas de referência"; leituras de sensores
  só vêm de dispositivos, do simulador ou da conta demo (`isDemo`). O ROI só se calcula com custos registados.
- **Recomendações têm de ter razões.** Um projeto sem ligação a um problema ou objetivo declarado é excluído.
  Se mexeres no motor (`recommendations/engine/`), o caso Huambo do `engine.spec.ts` tem de continuar a passar.
- **Segurança IoT em dois lados.** Comandos passam por `iot/safety.ts` no servidor e o firmware tem os seus
  próprios limites. Desligar nunca é bloqueado; ligar uma bomba sem proteção contra funcionamento a seco não passa.
- **Acesso a propriedades só via `FarmAccessService`.** É o único ponto de isolamento multi-tenant.

## Imagens

- Só fotografias reais com licença livre (Wikimedia Commons), em `apps/web/public/images`, registadas em
  `src/content/photos.ts` com autor e licença. Usa sempre `<Photo>`: mostra o crédito, que a licença exige.
- Nunca rotular uma foto como "Angola" sem confirmar a localização nas categorias do Commons.
- O globo 3D da landing usa texturas NASA (domínio público) em `public/images/globe`, registadas em
  `src/content/globe-textures.ts` e mostradas em `/creditos`. As nuvens são procedurais, não meteorologia real.
- Fotos de projetos são "sistemas semelhantes em uso": diz isso na interface. Cada projeto tem foto e
  ilustração em `src/content/project-media.ts`; as ilustrações animadas estão em
  `components/illustrations/system-illustration.tsx` e os valores mostrados devem bater com o motor e o firmware.

## Armadilhas conhecidas

- O embedded-postgres tem de ficar na versão `17.11.0-beta.19`; a 18 rebenta no Windows.
- A API compila com `incremental: false`. Com incremental ligado, o `nest build` deixa o `dist` incompleto.
- Depois de alterar `schema.prisma`: `npx prisma migrate dev` dentro de `apps/api`.
- Os números do caso Huambo na landing estão escritos à mão; se mudares preços ou pesos do motor, atualiza-os.
