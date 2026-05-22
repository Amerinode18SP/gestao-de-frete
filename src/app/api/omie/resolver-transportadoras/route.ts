// ============================================================
// FREIGHT-MS — POST /api/omie/resolver-transportadoras
// Busca nome das transportadoras no Omie para CTes sem fornecedor
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const maxDuration = 60

const OMIE_BASE = 'https://app.omie.com.br/api/v1'

async function consultarCliente(codigo: number): Promise<{ nome: string; cnpj: string } | null> {
  try {
    const res = await fetch(`${OMIE_BASE}/geral/clientes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key:    process.env.OMIE_APP_KEY,
        app_secret: process.env.OMIE_APP_SECRET,
        call:       'ConsultarCliente',
        param:      [{ codigo_cliente_omie: codigo }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const nome = data.razao_social ?? data.nome_fantasia ?? ''
    if (!nome) return null
    return { nome, cnpj: (data.cnpj_cpf ?? '').replace(/\D/g, '') }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth    = req.headers.get('authorization')
    const cronKey = req.headers.get('x-cron-key')
    if (cronKey !== process.env.CRON_SECRET && !auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { empresa_id } = body
    if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatório' }, { status: 400 })

    const supabase = createSupabaseAdmin()

    // FIX: buscar apenas CTes PENDENTES sem fornecedor_id
    // CTes Faturadas/Recebidas nunca vão ter omie_fornecedor_codigo (limitação API Omie)
    // Sem esse filtro o botão fica em loop infinito
    const { data: ctesSemFornecedor } = await supabase
      .from('ctes')
      .select('omie_fornecedor_codigo')
      .eq('empresa_id', empresa_id)
      .eq('status', 'Pendente')        // ← FIX: só Pendentes
      .is('fornecedor_id', null)
      .not('omie_fornecedor_codigo', 'is', null)
      .limit(500)

    if (!ctesSemFornecedor || ctesSemFornecedor.length === 0) {
      return NextResponse.json({ message: 'Nenhuma CTe pendente de transportadora', resolvidos: 0, tem_mais: false })
    }

    // Códigos únicos
    const codigosUnicos = [...new Set(
      ctesSemFornecedor.map(c => c.omie_fornecedor_codigo).filter(Boolean)
    )] as number[]

    console.log(`[resolver] ${codigosUnicos.length} transportadoras únicas para resolver`)

    // 2. Para cada código, buscar no Omie e salvar na tabela fornecedores
    let resolvidos = 0
    const LOTE = 5

    for (let i = 0; i < codigosUnicos.length; i += LOTE) {
      const lote = codigosUnicos.slice(i, i + LOTE)

      await Promise.all(lote.map(async (codigo) => {
        const { data: existente } = await supabase
          .from('fornecedores')
          .select('id')
          .eq('empresa_id', empresa_id)
          .eq('omie_codigo', codigo)
          .maybeSingle()

        let fornecedorId = existente?.id

        if (!fornecedorId) {
          const info = await consultarCliente(codigo)
          if (info?.nome) {
            const { data: novo } = await supabase
              .from('fornecedores')
              .upsert({
                empresa_id,
                nome:        info.nome,
                cnpj:        info.cnpj || null,
                omie_codigo: codigo,
                ativo:       true,
              }, { onConflict: 'empresa_id,omie_codigo' })
              .select('id')
              .single()
            fornecedorId = novo?.id
          }
        }

        if (fornecedorId) {
          await supabase
            .from('ctes')
            .update({ fornecedor_id: fornecedorId })
            .eq('empresa_id', empresa_id)
            .eq('omie_fornecedor_codigo', codigo)
            .is('fornecedor_id', null)
          resolvidos++
        }
      }))

      if (i + LOTE < codigosUnicos.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // FIX: verificar restantes também só para Pendentes
    const { count: restantes } = await supabase
      .from('ctes')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresa_id)
      .eq('status', 'Pendente')        // ← FIX: só Pendentes
      .is('fornecedor_id', null)
      .not('omie_fornecedor_codigo', 'is', null)

    return NextResponse.json({
      message: `${resolvidos} transportadoras resolvidas`,
      resolvidos,
      ainda_pendentes: restantes ?? 0,
      tem_mais: (restantes ?? 0) > 0,
    })
  } catch (err: any) {
    console.error('[resolver] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
