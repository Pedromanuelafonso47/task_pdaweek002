# Deploy

## Topologia recomendada

| Componente | Serviço | Notas |
|---|---|---|
| Web (Next.js) | Vercel | `NEXT_PUBLIC_API_URL=https://api.<domínio>/api`; root `apps/web` |
| API (NestJS) | Container (Fly.io, Render, Railway, AWS ECS, Azure Container Apps) | `apps/api/Dockerfile`; WebSockets ativos |
| PostgreSQL | Gerido com PostGIS (Neon, Supabase, RDS) | `DATABASE_URL` |
| Redis | Gerido (Upstash) | opcional nesta versão |
| MQTT | EMQX Cloud ou EMQX self-hosted | ver `docs/IOT.md` |
| Ficheiros | S3 / Cloudinary | fotografias das propriedades (campo `Farm.photos`) — integração preparada, requer credenciais |

## Variáveis da API

Ver `apps/api/.env.example`. Em produção:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: ≥ 32 caracteres aleatórios, diferentes entre si.
- `WEB_ORIGIN`: domínio(s) do frontend separados por vírgula (CORS + WebSocket).
- `NODE_ENV=production` ativa o cookie `Secure`. Web e API devem partilhar o domínio registável
  (ex.: `app.agrogenius.ao` e `api.agrogenius.ao`) para o cookie `SameSite=Lax` do refresh token funcionar.
- `ANTHROPIC_API_KEY` (opcional): ativa o Agro AI generativo; sem chave funciona em modo baseado em regras.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: conta de administrador criada pelo seed.

## Primeira instalação

```bash
docker build -f apps/api/Dockerfile -t agrogenius-api .
docker run --env-file apps/api/.env -p 4000:4000 agrogenius-api   # corre migrate deploy no arranque
docker run --env-file apps/api/.env agrogenius-api npx prisma db seed   # catálogo + admin (idempotente)
```

## PostGIS (quando forem precisas consultas espaciais)

As geometrias são guardadas como GeoJSON (`Farm.boundary`, `Field.boundary`). Para ativar consultas espaciais
numa BD com PostGIS, criar uma migração SQL:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE "Field" ADD COLUMN geom geometry(Polygon, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_GeomFromGeoJSON(boundary::text), 4326)) STORED;
CREATE INDEX field_geom_idx ON "Field" USING GIST (geom);
```

O mesmo padrão aplica-se a `Farm`. Prepara a integração futura de índices de vegetação (NDVI) por polígono.

## CI

`.github/workflows/ci.yml`: typecheck, testes unitários, build, testes de ponta a ponta contra a API real
com PostGIS e build do frontend.
