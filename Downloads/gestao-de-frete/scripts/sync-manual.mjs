#!/usr/bin/env node
// ============================================================
// GESTÃO DE FRETE — Sync manual com Omie
// Executa: node scripts/sync-manual.mjs
// ============================================================

import https from 'https'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Carregar .env.local manualmente
const envFile = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k]) => k)
)

const APP_KEY    = env.OMIE_APP_KEY
const APP_SECRET = env.OMIE_APP_SECRET
const EMPRESA_ID = process.argv[2] || env.EMPRESA_ID

if (!EMPRESA_ID) {
  console.error('❌ Informe o ID da empresa: node scripts/sync-manual.mjs SEU_EMPRESA_ID')
  process.exit(1)
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function omieRequest(call, param) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      call,
      param: [param],
    })

    const req = https.request({
      hostname: 'app.omie.com.br',
      path: '/api/v1/geral/cte/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.faultstring) reject(new Error(json.faultstring))
          else resolve(json)
        } catch (e) { reject(e) }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const MODAL_MAP = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
  '04': 'Ferroviário', '05': 'Dutoviário',
  'R': 'Rodoviário', 'A': 'Aéreo', 'M': 'Marítimo',
}
const TOMADOR_MAP = {
  '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor',
  '3': 'Destinatário', '4': 'Terceiros',
}
const STATUS_MAP = {
  'F': 'Faturado', 'R': 'Recebido', 'C': 'Cancelado', 'P': 'Pendente',
  'FATURADO': 'Faturado', 'RECEBIDO': 'Recebido',
  'CANCELADO': 'Cancelado', 'PENDENTE': 'Pendente',
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  console.log('\n🚚 GESTÃO DE FRETE — Sincronização Omie\n')
  console.log(`Empresa ID : ${EMPRESA_ID}`)
  console.log(`App Key    : ${APP_KEY}`)
  console.log(`Iniciando  : ${new Date().toLocaleString('pt-BR')}\n`)

  // Registrar sync
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({ empresa_id: EMPRESA_ID, status: 'running' })
    .select('id').single()

  let importados = 0, atualizados = 0, erros = 0

  try {
    // 1. Buscar CT-e existentes para comparação
    const { data: existentes } = await supabase
      .from('ctes').select('omie_id, id').eq('empresa_id', EMPRESA_ID)
    const existMap = new Map((existentes || []).map(c => [c.omie_id, c.id]))

    // 2. Buscar fornecedores e centros de custo
    const { data: fornecedores } = await supabase
      .from('fornecedores').select('id, cnpj').eq('empresa_id', EMPRESA_ID)
    const { data: centros } = await supabase
      .from('centros_custo').select('id, codigo').eq('empresa_id', EMPRESA_ID)
    const fornMap = new Map((fornecedores || []).map(f => [f.cnpj.replace(/\D/g,''), f.id]))
    const centMap = new Map((centros || []).map(c => [c.codigo, c.id]))

    // 3. Buscar todos os CT-e do Omie com paginação
    let pagina = 1, totalPags = 1, todos = []
    do {
      process.stdout.write(`\r📄 Buscando página ${pagina}/${totalPags}...`)
      const resp = await omieRequest('ListarCte', {
        nPagina: pagina, nRegPorPagina: 50,
        cOrdenarPor: 'DATA_EMISSAO', cOrdemDecrescente: 'S'
      })
      totalPags = resp.nTotPaginas || 1
      if (resp.listaCte) todos.push(...resp.listaCte)
      pagina++
      if (pagina <= totalPags) await sleep(400)
    } while (pagina <= totalPags)

    console.log(`\n✓ ${todos.length} CT-e encontrados no Omie\n`)

    // 4. Upsert em lotes de 50
    for (let i = 0; i < todos.length; i += 50) {
      const lote = todos.slice(i, i + 50)
      const registros = lote.map(raw => {
        const cnpjTomador = (raw.cCNPJTomador || '').replace(/\D/g,'')
        return {
          ...(existMap.has(raw.nCodCte) ? { id: existMap.get(raw.nCodCte) } : {}),
          empresa_id:        EMPRESA_ID,
          fornecedor_id:     fornMap.get(cnpjTomador) || null,
          centro_custo_id:   centMap.get(raw.cCodCentroCusto || '') || null,
          numero_cte:        raw.cNumCte || '',
          chave_acesso:      raw.cChaveCte || null,
          omie_id:           raw.nCodCte,
          omie_numero_nf:    raw.cNumNF || null,
          tomador_tipo:      TOMADOR_MAP[raw.cTipoTomador] || 'Terceiros',
          remetente_nome:    raw.cNomeRemetente || null,
          remetente_cnpj:    (raw.cCNPJRemetente || '').replace(/\D/g,'') || null,
          destinatario_nome: raw.cNomeDestinatario || null,
          destinatario_cnpj: (raw.cCNPJDestinatario || '').replace(/\D/g,'') || null,
          tomador_nome:      raw.cNomeTomador || null,
          tomador_cnpj:      cnpjTomador || null,
          uf_origem:         raw.cUFOrigem || null,
          uf_destino:        raw.cUFDestino || null,
          modal:             MODAL_MAP[raw.cModalTransp] || 'Rodoviário',
          sistema_operacao:  raw.cModalTransp || null,
          valor_servico:     raw.nValorCte || 0,
          valor_mercadoria:  raw.nValorMerc || 0,
          peso_real:         raw.nPesoReal || 0,
          peso_cubado:       raw.nPesoCubado || 0,
          peso_taxado:       raw.nPesoTaxado || 0,
          link_nfe:          raw.cLinkNFe || null,
          status:            STATUS_MAP[raw.cStatus] || 'Pendente',
          data_emissao:      raw.dDtEmissao
            ? raw.dDtEmissao.split('/').reverse().join('-') : null,
        }
      })

      const { error } = await supabase
        .from('ctes')
        .upsert(registros, { onConflict: 'omie_id', ignoreDuplicates: false })

      if (error) {
        console.error(`\n⚠ Lote ${Math.floor(i/50)+1} com erro:`, error.message)
        erros++
      } else {
        lote.forEach(r => {
          if (existMap.has(r.nCodCte)) atualizados++
          else importados++
        })
        process.stdout.write(`\r💾 Salvando... ${i + lote.length}/${todos.length} CT-e`)
      }
    }

    // 5. Atualizar log
    await supabase.from('sync_logs').update({
      status: 'success',
      finalizado_em: new Date().toISOString(),
      ctes_importados: importados,
      ctes_atualizados: atualizados,
    }).eq('id', logEntry.id)

    console.log('\n\n✅ Sincronização concluída!')
    console.log(`   ✓ Novos CT-e importados : ${importados}`)
    console.log(`   ✓ CT-e atualizados      : ${atualizados}`)
    if (erros > 0) console.log(`   ⚠ Erros                 : ${erros}`)
    console.log(`   ⏱ Finalizado em         : ${new Date().toLocaleString('pt-BR')}\n`)

  } catch (err) {
    console.error('\n❌ Erro crítico:', err.message)
    if (logEntry) {
      await supabase.from('sync_logs').update({
        status: 'error',
        finalizado_em: new Date().toISOString(),
        erro_mensagem: err.message,
      }).eq('id', logEntry.id)
    }
    process.exit(1)
  }
}

main()
