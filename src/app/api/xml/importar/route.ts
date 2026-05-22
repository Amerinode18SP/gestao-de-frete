import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'
import JSZip from 'jszip'

export const maxDuration = 60

const MODAL_MAP: Record<string, string> = {
  '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
  '04': 'Ferroviário', '05': 'Dutoviário',
}

function getText(xml: string, tag: string): string {
  const i = xml.indexOf('<' + tag + '>')
  if (i === -1) return ''
  const j = xml.indexOf('</' + tag + '>', i)
  if (j === -1) return ''
  return xml.substring(i + tag.length + 2, j).trim()
}

function getDestNome(xml: string): string {
  const i = xml.indexOf('<dest>')
  const j = xml.indexOf('</dest>')
  if (i === -1 || j === -1) return ''
  return getText(xml.substring(i, j + 7), 'xNome')
}

function getPesoReal(xml: string): number {
  let pos = 0
  while (pos < xml.length) {
    const i = xml.indexOf('<infQ>', pos)
    if (i === -1) break
    const j = xml.indexOf('</infQ>', i)
    if (j === -1) break
    const b = xml.substring(i, j + 7)
    if (b.indexOf('Peso_Real') !== -1) {
      const qi = b.indexOf('<qCarga>')
      const qj = b.indexOf('</qCarga>')
      if (qi !== -1 && qj !== -1) return parseFloat(b.substring(qi + 8, qj)) || 0
    }
    pos = j + 7
  }
  return 0
}

function getChave(xml: string): string {
  const tag = 'Id="CTe'
  const i = xml.indexOf(tag)
  if (i === -1) return ''
  return xml.substring(i + tag.length, i + tag.length + 44)
}

function getNfRelacionada(xml: string): string {
  const i = xml.indexOf('<infNFe>')
  const j = xml.indexOf('</infNFe>')
  if (i === -1 || j === -1) return ''
  return getText(xml.substring(i, j + 9), 'chave')
}

function parse(xml: string) {
  return {
    chave:    getChave(xml),
    ufIni:    getText(xml, 'UFIni'),
    ufFim:    getText(xml, 'UFFim'),
    destNome: getDestNome(xml),
    modal:    MODAL_MAP[getText(xml, 'modal')] || 'Rodoviário',
    pesoReal: getPesoReal(xml),
    nfChave:  getNfRelacionada(xml),
    natOp:    getText(xml, 'natOp'),
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
    }
    const formData = await req.formData()
    const empresa_id = formData.get('empresa_id') as string
    const arquivo    = formData.get('arquivo') as File
    if (!empresa_id || !arquivo) {
      return NextResponse.json({ error: 'empresa_id e arquivo obrigatorios' }, { status: 400 })
    }
    const buffer = await arquivo.arrayBuffer()
    const zip    = await JSZip.loadAsync(buffer)
    const supabase = createSupabaseAdmin()
    let atualizados = 0
    let erros = 0
    const arquivos = Object.keys(zip.files).filter(f => f.endsWith('.xml'))
    console.log('[xml] ' + arquivos.length + ' XMLs')
    const LOTE = 20
    for (let i = 0; i < arquivos.length; i += LOTE) {
      const lote = arquivos.slice(i, i + LOTE)
      await Promise.all(lote.map(async (nome) => {
        try {
          const xml  = await zip.files[nome].async('string')
          const d    = parse(xml)
          if (!d.chave) return
          const upd: Record<string, any> = {}
          if (d.ufIni)        upd.uf_origem               = d.ufIni
          if (d.ufFim)        upd.uf_destino              = d.ufFim
          if (d.destNome)     upd.destinatario_nome       = d.destNome
          if (d.modal)        upd.modal                   = d.modal
          if (d.pesoReal > 0) upd.peso_real               = d.pesoReal
          if (d.nfChave)      upd.nota_fiscal_relacionada = d.nfChave
          if (d.natOp)        upd.operacao_descricao      = d.natOp
          console.log('[xml] ' + d.chave.slice(0,10) + ' nf=' + d.nfChave.slice(0,10) + ' op=' + d.natOp.slice(0,20))
          if (Object.keys(upd).length === 0) return
          const { error } = await supabase.from('ctes').update(upd).eq('empresa_id', empresa_id).eq('chave_acesso', d.chave)
          if (error) { console.error('[xml] erro:', error.message); erros++ } else { atualizados++ }
        } catch(e: any) { erros++ }
      }))
    }
    console.log('[xml] fim: ' + atualizados + ' ok, ' + erros + ' erros')
    return NextResponse.json({ message: atualizados + ' CTes atualizadas', atualizados, erros })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}