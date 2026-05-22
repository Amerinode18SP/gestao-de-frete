// ============================================================
// FREIGHT-MS - POST /api/xml/importar
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import JSZip from 'jszip'

export const maxDuration = 60

const MODAL_MAP: Record<string, string> = {
  '01': 'Rodovi\u00e1rio', '02': 'A\u00e9reo', '03': 'Aquavi\u00e1rio',
  '04': 'Ferrovi\u00e1rio', '05': 'Dutovi\u00e1rio',
}

function extrairTexto(xml: string, tag: string): string {
  const idx = xml.indexOf('<' + tag + '>')
  if (idx === -1) return ''
  const start = idx + tag.length + 2
  const end = xml.indexOf('</' + tag + '>', start)
  if (end === -1) return ''
  return xml.substring(start, end).trim()
}

function extrairDestNome(xml: string): string {
  const ini = xml.indexOf('<dest>')
  const fim = xml.indexOf('</dest>')
  if (ini === -1 || fim === -1) return ''
  const bloco = xml.substring(ini, fim + 7)
  return extrairTexto(bloco, 'xNome')
}

function extrairPesoReal(xml: string): number {
  let pos = 0
  while (pos < xml.length) {
    const ini = xml.indexOf('<infQ>', pos)
    if (ini === -1) break
    const fim = xml.indexOf('</infQ>', ini)
    if (fim === -1) break
    const bloco = xml.substring(ini, fim + 7)
    if (bloco.indexOf('Peso_Real') !== -1) {
      const qi = bloco.indexOf('<qCarga>')
      const qf = bloco.indexOf('</qCarga>')
      if (qi !== -1 && qf !== -1) return parseFloat(bloco.substring(qi + 8, qf)) || 0
    }
    pos = fim + 7
  }
  return 0
}

function extrairChave(xml: string): string {
  const tag = 'Id="CTe'
  const idx = xml.indexOf(tag)
  if (idx === -1) return ''
  return xml.substring(idx + tag.length, idx + tag.length + 44)
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }
    const formData = await req.formData()
    const empresa_id = formData.get('empresa_id') as string
    const arquivo = formData.get('arquivo') as File
    if (!empresa_id || !arquivo) {
      return NextResponse.json({ error: 'empresa_id e arquivo obrigatorios' }, { status: 400 })
    }
    const buffer = await arquivo.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)
    const supabase = createSupabaseAdmin()
    let atualizados = 0
    let erros = 0
    const arquivos = Object.keys(zip.files).filter(f => f.endsWith('.xml'))
    console.log('[xml-import] ' + arquivos.length + ' XMLs no ZIP')
    const LOTE = 20
    for (let i = 0; i < arquivos.length; i += LOTE) {
      const lote = arquivos.slice(i, i + LOTE)
      await Promise.all(lote.map(async (nome) => {
        try {
          const xml = await zip.files[nome].async('string')
          const chave = extrairChave(xml)
          if (!chave) return
          const ufIni = extrairTexto(xml, 'UFIni')
          const ufFim = extrairTexto(xml, 'UFFim')
          const destNome = extrairDestNome(xml)
          const modalCod = extrairTexto(xml, 'modal')
          const modal = MODAL_MAP[modalCod] || 'Rodovi\u00e1rio'
          const pesoReal = extrairPesoReal(xml)
          console.log('[xml-import] ' + chave + ' dest=' + destNome + ' peso=' + pesoReal)
          const upd: Record<string, any> = {}
          if (ufIni) upd.uf_origem = ufIni
          if (ufFim) upd.uf_destino = ufFim
          if (destNome) upd.destinatario_nome = destNome
          if (modal) upd.modal = modal
          if (pesoReal > 0) upd.peso_real = pesoReal
          if (Object.keys(upd).length === 0) return
          const { error } = await supabase.from('ctes').update(upd).eq('empresa_id', empresa_id).eq('chave_acesso', chave)
          if (error) { console.error('[xml-import] erro:', error.message); erros++ } else { atualizados++ }
        } catch(e: any) { erros++ }
      }))
    }
    console.log('[xml-import] fim: ' + atualizados + ' atualizados')
    return NextResponse.json({ message: atualizados + ' CTes atualizadas', atualizados, erros })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}