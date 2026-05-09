// Migração automática que roda no boot do servidor.
// Requer DATABASE_URL (string de conexão Postgres do Supabase).
// Se DATABASE_URL não estiver configurada, apenas loga um aviso e segue.

const MIGRATIONS = [
  {
    name: 'add_oficina_e_anexos',
    sql: `
      ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS oficina VARCHAR(150);
      ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS anexos  JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE manutencoes DROP CONSTRAINT IF EXISTS manutencoes_status_check;
      ALTER TABLE manutencoes ADD  CONSTRAINT manutencoes_status_check
        CHECK (status IN ('Em Andamento','Retornado','Cancelado','Orçamento','Aprovado'));
    `
  }
]

async function runMigrations() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!url) {
    console.warn('⚠️  DATABASE_URL não configurada — pulando migração automática.')
    console.warn('   Configure a string de conexão Postgres no Railway para auto-migrar.')
    return
  }

  let Client
  try {
    ;({ Client } = require('pg'))
  } catch (e) {
    console.warn('⚠️  pacote "pg" indisponível — pulando migração automática.')
    return
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    for (const m of MIGRATIONS) {
      console.log(`🛠️  rodando migração: ${m.name}`)
      await client.query(m.sql)
    }
    console.log('✅ migrações concluídas')
  } catch (err) {
    console.error('❌ erro na migração:', err.message)
  } finally {
    await client.end().catch(() => {})
  }
}

module.exports = { runMigrations }
