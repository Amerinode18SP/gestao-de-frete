#!/usr/bin/env node
// ============================================================
// GESTÃO DE FRETE — Setup inicial
// Executa: node scripts/setup.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js'

// Tentar carregar .env.local
try {
  const { readFileSync } = await import('fs')
  const env = readFileSync('.env.local', 'utf8')
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && !k.startsWith('#') && v.length) {
      process.env[k.trim()] = v.join('=').trim()
    }
  })
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ptqdcemtgznxrstujysq.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_EtwFhpxbHxBsu0M9Ufrlng_taEicP4_'
const OMIE_KEY     = process.env.OMIE_APP_KEY    || '4330627336035'
const OMIE_SECRET  = process.env.OMIE_APP_SECRET || '516e6e6960a06aac52da9d2a4480bd5'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('\n🚚 GESTÃO DE FRETE — Setup inicial\n')
  console.log('Supabase:', SUPABASE_URL)

  // 1. Criar empresa
  console.log('\n📋 Criando empresa...')
  const { data: empresa, error: errEmpresa } = await supabase
    .from('empresas')
    .insert({
      nome: 'Gestão de Frete',
      cnpj: '00.000.000/0001-00',
      omie_app_key: OMIE_KEY,
      omie_app_secret: OMIE_SECRET,
    })
    .select('id')
    .single()

  if (errEmpresa) {
    console.error('❌ Erro:', errEmpresa.message)
    console.log('\n⚠️  Verifique se executou o SQL no Supabase primeiro!')
    process.exit(1)
  }

  const empresaId = empresa.id
  console.log('✓ Empresa criada:', empresaId)

  // 2. Centros de custo
  console.log('\n📂 Criando centros de custo...')
  await supabase.from('centros_custo').insert([
    { empresa_id: empresaId, nome: 'Logística SP', codigo: 'LOG-SP' },
    { empresa_id: empresaId, nome: 'Logística RJ', codigo: 'LOG-RJ' },
    { empresa_id: empresaId, nome: 'Comercial',    codigo: 'COM-00' },
    { empresa_id: empresaId, nome: 'E-commerce',   codigo: 'ECO-00' },
  ])
  console.log('✓ 4 centros de custo criados')

  // 3. Parâmetros de alerta
  console.log('\n⚠️  Configurando alertas...')
  await supabase.from('parametros_alerta').insert({
    empresa_id: empresaId,
    limite_semanal: 45000,
    limite_mensal: 180000,
    limite_fornecedor_mes: 60000,
    tolerancia_pct: 5,
    frequencia_relatorio: 'Mensal',
  })
  console.log('✓ Parâmetros de alerta configurados')

  console.log('\n✅ Setup concluído com sucesso!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📌 EMPRESA_ID:', empresaId)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\nAdicionem no .env.local:')
  console.log(`EMPRESA_ID=${empresaId}`)
  console.log('\nDepois execute a sincronização com o Omie:')
  console.log(`node scripts/sync-manual.mjs ${empresaId}\n`)
}

main().catch(err => {
  console.error('Erro fatal:', err.message)
  process.exit(1)
})
