# 🚚 Gestão de Frete

Sistema de gestão e análise de CT-e integrado ao Omie ERP.

**Stack:** Next.js 14 · Supabase · Railway · GitHub

---

## ⚡ Início rápido (3 passos)

### Passo 1 — Supabase

1. Acesse [supabase.com](https://supabase.com) → seu projeto
2. Vá em **SQL Editor** e execute o arquivo:
   `supabase/migrations/001_initial_schema.sql`
3. Vá em **Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### Passo 2 — Configurar e rodar localmente

```bash
# Instalar dependências
npm install

# Copiar e preencher variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com as 3 chaves do Supabase acima

# Criar empresa e estrutura inicial
node scripts/setup.mjs
# → Guarde o EMPRESA_ID gerado e adicione no .env.local

# Primeira sincronização com Omie
node scripts/sync-manual.mjs SEU_EMPRESA_ID

# Rodar o sistema
npm run dev
# Acesse: http://localhost:3000
```

### Passo 3 — Deploy no Railway

1. Faça push para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: gestão de frete v1"
   git remote add origin https://github.com/SEU_USUARIO/gestao-de-frete.git
   git push -u origin main
   ```
2. No [Railway](https://railway.app): **New Project → Deploy from GitHub**
3. Selecione o repositório `gestao-de-frete`
4. Em **Variables**, adicione todas as variáveis do `.env.local`
5. Deploy automático! ✅

### Cron automático no Railway (sync a cada 6h)

Em **Settings → Cron Jobs** no Railway:
- **Schedule:** `0 */6 * * *`
- **Command:**
```
curl -X POST $RAILWAY_PUBLIC_DOMAIN/api/omie \
  -H "x-cron-key: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"empresa_id\": \"$EMPRESA_ID\"}"
```

---

## Credenciais Omie (já configuradas)

| Variável | Valor |
|----------|-------|
| `OMIE_APP_KEY` | `4330627336035` |
| `OMIE_APP_SECRET` | `516e6e6960a06aac52da9d2a4480bd5` |

---

## Estrutura

```
gestao-de-frete/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Todas as páginas do sistema
│   │   └── api/
│   │       ├── omie/             # Sync Omie → Supabase
│   │       ├── cte/              # CT-e + Dashboard analytics
│   │       └── solicitacoes/     # Solicitações de frete
│   ├── lib/
│   │   ├── omie/client.ts        # Cliente API Omie
│   │   ├── omie/sync.ts          # Serviço de sincronização
│   │   └── supabase/client.ts    # Clientes Supabase
│   └── types/index.ts            # Tipos TypeScript completos
├── supabase/migrations/          # Schema do banco
├── scripts/
│   ├── setup.mjs                 # Setup inicial (rodar 1x)
│   └── sync-manual.mjs           # Sync manual pelo terminal
└── .env.example                  # Modelo de variáveis
```

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/omie` | Disparar sync com Omie |
| `GET` | `/api/omie?empresa_id=` | Status dos últimos syncs |
| `GET` | `/api/cte?empresa_id=&status=&modal=&uf_destino=` | Listar CT-e com filtros |
| `GET` | `/api/cte/dashboard?empresa_id=&periodo=` | Métricas do dashboard |
