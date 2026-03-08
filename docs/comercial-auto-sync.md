# Comercial Auto Sync (30 em 30 minutos)

## Objetivo
Centralizar os dados do painel comercial em backend unico, com sincronizacao automatica do sistema Monaco.

## Como funciona
1. O backend (`server/comercial-backend.mjs`) roda com banco JSON central.
2. A cada `COMERCIAL_SYNC_INTERVAL_MINUTES` (padrao `30`), ele:
   - faz login no Monaco,
   - consulta `CaixaVendedor` do dia atual,
   - faz backfill automatico dos dias faltantes do mes (dia 1 ate hoje),
   - atualiza faturamento realizado por colaborador,
   - detecta novos cambistas pela chave `area + nome normalizado`,
   - salva historico de `firstSeen`.
3. No primeiro sync, ele cria baseline (nao conta todos como novos).
4. O frontend consome os dados via `VITE_COMERCIAL_API_URL`.
5. Em producao, as rotas (exceto `/health`) exigem `Authorization: Bearer <COMERCIAL_API_TOKEN>`.

## Endpoints
- `GET /api/comercial/health`
- `GET /api/comercial/results?year=2026&month=3`
- `PUT /api/comercial/results`
- `GET /api/comercial/monthly-config?year=2026&month=3`
- `PUT /api/comercial/monthly-config`
- `GET /api/comercial/annual-config?year=2026`
- `PUT /api/comercial/annual-config`
- `GET /api/comercial/sync-status`
- `POST /api/comercial/sync-now`

## Desenvolvimento local
1. Configure variaveis:
   - `MONACO_LOGIN`
   - `MONACO_SENHA`
2. Suba o backend:
```bash
npm run comercial:server
```
3. Configure no frontend:
```bash
VITE_COMERCIAL_API_URL=http://localhost:8787/api/comercial
```
4. Suba o frontend:
```bash
npm run dev
```

## Variaveis principais do backend
- `PORT` (Render define automaticamente)
- `COMERCIAL_PORT=8787`
- `COMERCIAL_API_BASE=/api/comercial`
- `COMERCIAL_DB_PATH=server/data/comercial-db.json`
- `COMERCIAL_SYNC_INTERVAL_MINUTES=30`
- `COMERCIAL_SYNC_TIMEZONE=America/Fortaleza`
- `COMERCIAL_BOOTSTRAP_BASELINE=1`
- `COMERCIAL_API_TOKEN=<token-forte>`
- `COMERCIAL_CORS_ORIGIN=https://seu-frontend`
- `MONACO_BASE_URL=https://monacoloterias.ddns.net`
- `MONACO_LOGIN=<seu-login>`
- `MONACO_SENHA=<sua-senha>`
- `COMERCIAL_AREA_OWNERS_JSON={"00":"Bruninho","00 Bruninho":"Bruninho","00 Bruno":"Bruninho","02":"Dije","02 Dije":"Dije","03":"Anderson","04":"Neutel","04 Chefe":"Neutel","04 Neutel":"Neutel","06":"Victor","06 Torugo":"Victor","07":"Jarbas","07 Professor":"Jarbas","07 Jarbas":"Jarbas"}`

## Producao
1. Hospede backend e frontend no mesmo dominio (ou ajuste CORS).
2. Rode o backend como servico (PM2/Systemd/Docker).
3. Garanta persistencia do `COMERCIAL_DB_PATH` em volume.
4. Para Render, use o blueprint em `render.yaml` e o guia `docs/deploy-render-starter.md`.
