// ============================================================
// FREIGHT-MS — POST /api/xml/importar
// Recebe ZIP com XMLs de CT-e e extrai origem/destino/peso
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import JSZip from 'jszip'

export const maxDuration = 60

const MODAL_MAP: Record<string, string> = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
  '04': 'Ferroviário', '05': 'Dutoviário',
}

function extrairTexto(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`))
  return match?.[1]?.trim() ?? ''
}

function extrairPesoReal(xml: string): number {
  const blocos = xml.match(/<infQ>[\s\S]*?<\/infQ>/g) ?? []
  for (const bloco of blocos) {
    if (bloco.includes('Peso_Real')) {
      const q = bloco.match(/<qCarga>([^<]*)<\/qCarga>/)
      if (q) return parseFloat(q[1]) || 0
    }
  }
  return 0
}

function extrairDadosCte(xml: string) {
  const chaveMatch = xml.match(/Id="CTe(\d{44})"/)
  const chave = chaveMatch?.[1] ?? ''

  const ufIni = extrairTexto(xml, 'UFIni')
  const ufFim = extrairTexto(xml, 'UFFim')
  const munIni = extrairTexto(xml, 'xMunIni')
  const munFim = extrairTexto(xml, 'xMunFim')

  // Extrair destinatário — bloco <dest>
  const destMatch = xml.match(/<dest>[\s\S]*?<\/dest>/)
  const destBloco = destMatch?.[0] ?? ''
  const destNome = extrairTexto(destBloco, 'xNome')

  const modalCod = extrairTexto(xml, 'modal')
  const modal = MODAL_MAP[modalCod] ?? 'Rodoviário'

  const pesoReal = extrairPesoReal(xml)

  console.log(`[xml-import] Chave: ${chave} | UFIni: ${ufIni} | UFFim: ${ufFim} | Dest: ${destNome} | Peso: ${pesoReal}`)

  return { chave, ufIni, ufFim, munIni, munFim, destNome, modal, pesoReal }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const empresa_id = formData.get('empresa_id') as string
    const arquivo = formData.get('arquivo') as File

    if (!empresa_id || !arquivo) {
      return NextResponse.json({ error: 'empresa_id e arquivo obrigatórios' }, { status: 400 })
    }

    const buffer = await arquivo.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const supabase = createSupabaseAdmin()

    let processados = 0
    let atualizados = 0
    let erros = 0

    const arquivos = Object.keys(zip.files).filter(f => f.endsWith('.xml'))
    console.log(`[xml-import] ${arquivos.length} XMLs encontrados no ZIP`)

    const LOTE = 20
    for (let i = 0; i < arquivos.length; i += LOTE) {
      const lote = arquivos.slice(i, i + LOTE)

      await Promise.all(lote.map(async (nomeArquivo) => {
        try {
          const conteudo = await zip.files[nomeArquivo].async('string')
          const dados = extrairDadosCte(conteudo)

          if (!dados.chave) return

          // Montar objeto de update apenas com campos que têm valor
          const updateData: Record<string, any> = {}
          if (dados.ufIni)    updateData.uf_origem         = dados.ufIni
          if (dados.ufFim)    updateData.uf_destino        = dados.ufFim
          if (dados.destNome) updateData.destinatario_nome = dados.destNome
          if (dados.modal)    updateData.modal             = dados.modal
          if (dados.pesoReal > 0) updateData.peso_real     = dados.pesoReal

          if (Object.keys(updateData).length === 0) return

          const { error } = await supabase
            .from('ctes')
            .update(updateData)
            .eq('empresa_id', empresa_id)
            .eq('chave_acesso', dados.chave)

          if (error) {
            console.error(`[xml-import] Erro ao atualizar ${dados.chave}:`, error.message)
            erros++
          } else {
            atualizados++
          }
          processados++
        } catch (e: any) {
          console.error(`[xml-import] Erro no arquivo ${nomeArquivo}:`, e.message)
          erros++
        }
      }))
    }

    console.log(`[xml-import] Concluído: ${atualizados} atualizados, ${erros} erros`)

    return NextResponse.json({
      message: `${atualizados} CTes atualizadas com dados do XML`,
      processados,
      atualizados,
      erros,
    })
  } catch (err: any) {
    console.error('[xml-import] Erro crítico:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
