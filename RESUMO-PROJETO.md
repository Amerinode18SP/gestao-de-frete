# 🚛 Gestão de Log — Resumo do Projeto

## 📍 Situação Atual (24/05/2026)

### URLs
- **Sistema online (URL antiga ainda ativa):** https://gestao-de-frete.vercel.app
- **Sistema online (URL nova — rodar vercel --prod para ativar):** https://gestao-de-log.vercel.app
- **GitHub:** https://github.com/Amerinode18SP/gestao-de-log

### Pasta local
```
C:\Users\Ana\OneDrive - Amerinode do Brasil\Compras\AP GESTAO DE FRETE\gestao-de-frete
```

---

## 🗄️ Banco de Dados (Supabase)

### Empresa
- **Nome:** Gestão de Log
- **ID:** `22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca`
- **CNPJ:** 00.000.000/0001-00

### Tabelas principais
- `empresas` — cadastro da empresa
- `ctes` — conhecimentos de transporte
  - Tem coluna `omie_fornecedor_codigo bigint`
  - Tem coluna `omie_id`
  - Tem coluna `centro_custo_nome` — preenchido via script
- `fornecedores` — transportadoras
  - Tem coluna `omie_codigo bigint`
  - Tem constraint UNIQUE em `empresa_id, omie_codigo`
- `centros_custo`
- `sync_logs`
- `alertas_historico`
- `parametros_alerta` — limite_semanal, limite_mensal, limite_fornecedor_mes, tolerancia_pct, email_alertas, frequencia_relatorio
- `perfis_usuario` — id (=auth user id), empresa_id, nome, email, papel, ativo, avatar_url

---

## 🔧 Stack Técnica
- **Frontend/Backend:** Next.js 16.2.6 (App Router, TypeScript)
- **Banco:** Supabase (PostgreSQL)
- **Deploy:** Vercel (Hobby plan — timeout 60s)
- **API externa:** Omie (contas a pagar)
- **Auth:** Supabase Auth (email + senha)

---

## 📁 Estrutura de Arquivos Importantes

```
src/
  app/
    (auth)/
      login/page.tsx          ← Página de login
      esqueci-senha/page.tsx
      redefinir-senha/page.tsx
    (dashboard)/
      dashboard/page.tsx      ← Dashboard principal (CT-e)
      relatorios/page.tsx     ← Relatórios com gráficos
      alertas/page.tsx        ← Alertas de limite
      usuarios/page.tsx       ← Gerenciar usuários
      configuracoes/page.tsx  ← Configurar parâmetros de alerta
    api/
      omie/
        sync/route.ts         ← POST: sync CTes em lotes
        resolver-transportadoras/route.ts
      ctes/
        route.ts              ← GET: lista CTes
        resumo/route.ts       ← GET: contagens por status
      relatorios/
        route.ts              ← GET: dados para relatórios
        exportar/route.ts     ← GET: exportar Excel (.xls)
      alertas/
        route.ts              ← GET: alertas e gastos
        parametros/route.ts   ← GET/PATCH: parâmetros de alerta
      usuarios/
        route.ts              ← GET/PATCH: listar e editar usuários
        convidar/route.ts     ← POST: convidar novo usuário
      sync-status/route.ts    ← GET: último sync
      me/route.ts             ← GET: perfil do usuário logado
  hooks/
    useAuth.ts                ← Hook de autenticação (busca via /api/me)
  lib/
    omie/
      client.ts               ← OmieClient
      sync.ts                 ← syncCtes()
    supabase/
      client.ts               ← createSupabaseBrowser() + createSupabaseAdmin()
  middleware.ts               ← Protege rotas — redireciona para /login
```

---

## 👤 Sistema de Autenticação

### Usuários cadastrados
- **compras3@amerinode.com.br** — papel: administrador, nome: Ana

### Papéis
- **Administrador:** acesso total — vê botões Importar XMLs, Preencher Transportadoras, Sincronizar CTes, menu Usuários e Configurações
- **Visualizador:** só leitura — vê dashboard, relatórios, alertas, sem botões de ação

### Como convidar usuário
1. Acessar /usuarios
2. Clicar em "+ Convidar usuário"
3. Preencher nome, email e papel
4. O Supabase envia email de convite

---

## 🔄 Como Funciona o Sistema

### API Omie — Descobertas Importantes
- CTes vêm via **Contas a Pagar** (`/financas/contapagar/` → `ListarContasPagar`)
- Filtrar por `codigo_tipo_documento === 'CTE'`
- Transportadoras estão em **`/geral/clientes/`** → `ConsultarCliente`
- **CTes PAGAS:** Omie retorna `distribuicao[0].cDesDep` com centro de custo ✅
- **CTes PAGAS:** Omie NÃO retorna `codigo_cliente_fornecedor` (transportadora) ❌
- Departamentos disponíveis via `/geral/departamentos/` → `ListarDepartamentos` (108 departamentos)

### Mapeamento de Status
```
PAGO      → Faturado
ATRASADO  → Pendente
PREVISTO  → Pendente
CANCELADO → Cancelado
```

### Fluxo de Sync (automático)
1. **Sincronizar CTes** → importa CTes em lotes (20 páginas × 50 registros por chamada)
2. **Preencher Transportadoras** → roda automaticamente após sync concluir
3. **centro_custo_nome** → preenchido durante o sync via `distribuicao[0].cDesDep`

---

## 📊 Dados Atuais no Banco
- **Total CTes:** ~6.095 (5.255 via XML + ~840 via Omie)
- **Faturadas:** 5.311
- **A vencer:** 749
- **Canceladas:** 35
- **Valor Total:** R$ 4.945.587,80
- **centro_custo_nome preenchido:** ~1.086 CTes (Pendentes — Faturadas vêm automaticamente no sync)

---

## ⚙️ Parâmetros de Alerta (configuráveis em /configuracoes)
- **Limite semanal:** R$ 45.000
- **Limite mensal:** R$ 180.000
- **Limite por transportadora/mês:** R$ 60.000
- **Tolerância:** 5%
- **Email alertas:** (configurar em /configuracoes — aceita múltiplos separados por vírgula)
- **Frequência relatório:** Mensal

---

## 🚀 Pendências / Próximos Passos

### Imediato
1. **Ativar URL nova:** rodar `vercel --prod` para ativar https://gestao-de-log.vercel.app
2. **Verificar CTes após 21/05:** CTes novos do Omie não aparecem — verificar se foram lançados em Contas a Pagar no Omie

### Melhorias futuras
- Envio real de emails de alerta (integrar com SendGrid ou Resend)
- Senha para usuário ao ser convidado (hoje usa magic link do Supabase)
- Exportar Excel com mais filtros (por transportadora, centro de custo)
- Histórico de alterações nos CTes

---

## 💻 Comandos Úteis

```bash
# Deploy
git add .
git commit -m "descrição"
git push
vercel --prod

# Ver logs
vercel logs --level error --since 1h

# Preencher centro_custo_nome manualmente
node "C:\Users\Ana\Downloads\preencher_centro_custo.js"

# Escrever arquivo sem download
node "C:\Users\Ana\Downloads\write_arquivo.js"
```

### Como o Claude escreve arquivos
Gera script .js com `fs.writeFileSync` → baixa o .js → roda com node.

---

## 🏗️ Funcionalidades do Sistema

### Dashboard (CT-e)
- ✅ Cards: Total CTes, Valor Total, Faturadas, A vencer, Canceladas
- ✅ Tabela com paginação (50 por página)
- ✅ Filtros por status (Todos, Faturado, A vencer, Cancelado)
- ✅ Busca por número, transportadora ou destinatário
- ✅ Filtro por Data de Emissão
- ✅ Coluna Centro de Custo (260px)
- ✅ Botão Sync CTes com barra de progresso
- ✅ Botão Preencher Transportadoras (roda automaticamente após sync)
- ✅ Botão Importar XMLs
- ✅ Dropdown menu no nome do usuário (Gerenciar usuários / Configurações / Sair)
- ✅ Botões de ação visíveis só para Administrador

### Relatórios
- ✅ Cards: Total gasto, Média mensal, CTes emitidas, Ticket médio
- ✅ Gráfico de barras por mês
- ✅ Ranking por transportadora (barras horizontais)
- ✅ Ranking por centro de custo (barras horizontais)
- ✅ Filtro por período
- ✅ Botão Exportar Excel

### Alertas
- ✅ Gasto semanal com barra de progresso
- ✅ Gasto mensal
- ✅ Histórico de alertas

### Configurações (/configuracoes)
- ✅ Limite semanal, mensal, por transportadora
- ✅ Tolerância %
- ✅ Emails para alertas (múltiplos separados por vírgula)
- ✅ Frequência do relatório

### Usuários (/usuarios)
- ✅ Listar membros da equipe
- ✅ Convidar usuário (Administrador ou Visualizador)
- ✅ Alterar papel
- ✅ Ativar/desativar usuário

---

## 📝 Variáveis de Ambiente (.env.local e Vercel)

```
NEXT_PUBLIC_EMPRESA_ID=22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca
NEXT_PUBLIC_SUPABASE_URL=https://ptqdcemtgznxrstujysq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KnDbP8xCJVL5q3qm3ZwSgA_KQvrqGk-
SUPABASE_SERVICE_ROLE_KEY=sb_secret_EtwFhpxbHxBsu0M9Ufrlng_taEicP4_
OMIE_APP_KEY=4330627336035
OMIE_APP_SECRET=516e6e6960a06aac52da9d2a4480bd59
CRON_SECRET=gestao_frete_cron_2024_seguro
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```
