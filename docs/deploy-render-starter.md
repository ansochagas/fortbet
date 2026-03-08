# Deploy Render (Starter backend + frontend estatico)

## Arquitetura
- Backend: `node ./server/comercial-backend.mjs` em `Web Service` (Render Starter).
- Frontend: Vite em `Static Site` (Render Free).
- Persistencia: disco do Render no backend em `/var/data/comercial-db.json`.

## 1) Subir com Blueprint (`render.yaml`)
1. Envie o projeto para um repositorio Git.
2. No Render: `New +` -> `Blueprint`.
3. Selecione o repositorio com este `render.yaml`.
4. O Render criara:
   - `fortbet-comercial-api` (web)
   - `fortbet-dashboard` (static)

## 2) Configurar variaveis do backend
No servico `fortbet-comercial-api`, configure:
- `COMERCIAL_CORS_ORIGIN=https://SEU-FRONTEND.onrender.com`
- `COMERCIAL_API_TOKEN=<token-forte>`
- `MONACO_LOGIN=<seu-login>`
- `MONACO_SENHA=<sua-senha>`
- `COMERCIAL_AREA_OWNERS_JSON` (opcional, se quiser sobrescrever o padrao do codigo)

As variaveis abaixo ja estao no `render.yaml`:
- `COMERCIAL_API_BASE=/api/comercial`
- `COMERCIAL_DB_PATH=/var/data/comercial-db.json`
- `COMERCIAL_SYNC_INTERVAL_MINUTES=30`
- `COMERCIAL_SYNC_TIMEZONE=America/Fortaleza`
- `COMERCIAL_SYNC_ON_STARTUP=1`
- `MONACO_BASE_URL=https://monacoloterias.ddns.net`

## 3) Configurar variaveis do frontend
No servico `fortbet-dashboard`, configure:
- `VITE_COMERCIAL_API_URL=https://SEU-BACKEND.onrender.com/api/comercial`
- `VITE_COMERCIAL_API_TOKEN=<mesmo token do backend>`

Depois clique em `Manual Deploy` no static site para rebuild com as variaveis novas.

## 4) Validacao pos-deploy
1. Health:
   - `GET https://SEU-BACKEND.onrender.com/api/comercial/health`
2. Sync status (com token):
   - Header: `Authorization: Bearer <token>`
   - `GET https://SEU-BACKEND.onrender.com/api/comercial/sync-status`
3. Sync manual (com token):
   - Header: `Authorization: Bearer <token>`
   - `POST https://SEU-BACKEND.onrender.com/api/comercial/sync-now`
4. Frontend:
   - abrir `https://SEU-FRONTEND.onrender.com/comercial`
   - validar faturamento e novos cambistas.

## 5) Operacao minima
- Ative monitor de uptime no endpoint `/api/comercial/health`.
- Verifique `lastSuccessAt` em `/sync-status` (deve atualizar a cada 30 minutos).
- Mantenha backup do arquivo `comercial-db.json` periodicamente.

## Observacoes
- O backend agora usa `PORT` automaticamente (padrao Render).
- Se `COMERCIAL_API_TOKEN` estiver vazio, a API fica sem autenticacao.
- CORS aceita lista separada por virgula em `COMERCIAL_CORS_ORIGIN`.
