'use client'

import { useState, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

interface CteImportado {
  numero_cte: string
  chave_acesso: string
  remetente_nome: string
  remetente_cnpj: string
  destinatario_nome: string
  destinatario_cnpj: string
  tomador_nome: string
  tomador_cnpj: string
  tomador_tipo: string
  uf_origem: string
  uf_destino: string
  modal: string
  valor_servico: number
  valor_mercadoria: number
  peso_real: number
  peso_cubado: number
  peso_taxado: number
  data_emissao: string
  status: string
  arquivo: string
}

function getText(xml: Document, tag: string): string {
  return xml.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
}

function parseXmlCte(xmlStr: string, nomeArquivo: string): CteImportado | null {
  try {
    const parser = new DOMParser()
    const xml = parser.parseFromString(xmlStr, 'text/xml')

    // Chave de acesso (no atributo Id da tag infCte ou chCTe)
    const chave = getText(xml, 'chCTe') ||
      xml.querySelector('infCte')?.getAttribute('Id')?.replace('CTe', '') || ''

    // Número do CT-e
    const nCT = getText(xml, 'nCT')

    // Emitente (transportadora/fornecedor)
    const emit = xml.getElementsByTagName('emit')[0]
    const remNome = getText(emit as any, 'xNome') || getText(xml, 'xNome')
    const remCnpj = getText(emit as any, 'CNPJ') || ''

    // Tomador
    const toma = xml.getElementsByTagName('toma3')[0] || xml.getElementsByTagName('toma4')[0]
    const tomaTipo = xml.getElementsByTagName('toma')[0]?.textContent?.trim() ||
      (xml.getElementsByTagName('toma3')[0] ? '3' : '4')
    const tomaNome = getText(toma as any, 'xNome') || ''
    const tomaCnpj = getText(toma as any, 'CNPJ') || ''

    // Remetente
    const rem = xml.getElementsByTagName('rem')[0]
    const remetNome = getText(rem as any, 'xNome') || ''
    const remetCnpj = getText(rem as any, 'CNPJ') || ''

    // Destinatário
    const dest = xml.getElementsByTagName('dest')[0]
    const destNome = getText(dest as any, 'xNome') || ''
    const destCnpj = getText(dest as any, 'CNPJ') || ''

    // UFs
    const ufIni = getText(xml, 'UFIni') || getText(xml, 'cUFOrig') || ''
    const ufFim = getText(xml, 'UFFim') || getText(xml, 'cUFDest') || ''

    // Modal
    const modal = getText(xml, 'modal') || '01'
    const modalMap: Record<string, string> = {
      '01': 'Rodoviário', '02': 'Aéreo', '03': 'Aquaviário',
      '04': 'Ferroviário', '05': 'Dutoviário'
    }

    // Valores
    const vTPrest = parseFloat(getText(xml, 'vTPrest') || '0')
    const vCarga = parseFloat(getText(xml, 'vCarga') || '0')
    const qCarga = parseFloat(getText(xml, 'qCarga') || '0')

    // Data emissão
    const dhEmi = getText(xml, 'dhEmi') || getText(xml, 'dEmi') || ''
    const dataEmissao = dhEmi ? dhEmi.split('T')[0] : ''

    // Tomador tipo mapeado
    const tomadorMap: Record<string, string> = {
      '0': 'Remetente', '1': 'Expedidor', '2': 'Recebedor',
      '3': 'Destinatário', '4': 'Terceiros'
    }

    return {
      numero_cte:       nCT,
      chave_acesso:     chave,
      remetente_nome:   remNome,
      remetente_cnpj:   remCnpj.replace(/\D/g, ''),
      destinatario_nome: destNome,
      destinatario_cnpj: destCnpj.replace(/\D/g, ''),
      tomador_nome:     tomaNome || remetNome,
      tomador_cnpj:     tomaCnpj.replace(/\D/g, '') || remCnpj.replace(/\D/g, ''),
      tomador_tipo:     tomadorMap[tomaTipo] || 'Destinatário',
      uf_origem:        ufIni,
      uf_destino:       ufFim,
      modal:            modalMap[modal] || 'Rodoviário',
      valor_servico:    vTPrest,
      valor_mercadoria: vCarga,
      peso_real:        qCarga,
      peso_cubado:      qCarga,
      peso_taxado:      qCarga,
      data_emissao:     dataEmissao,
      status:           'Recebido',
      arquivo:          nomeArquivo,
    }
  } catch (e) {
    console.error('Erro ao parsear XML:', e)
    return null
  }
}

export default function ImportarXmlPage() {
  const supabase = createSupabaseBrowser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [arquivos, setArquivos] = useState<{ nome: string; status: 'aguardando' | 'ok' | 'erro' | 'duplicado'; cte?: CteImportado; erro?: string }[]>([])
  const [processando, setProcessando] = useState(false)
  const [resumo, setResumo] = useState<{ importados: number; erros: number; duplicados: number } | null>(null)

  async function processarArquivos(files: FileList) {
    const lista = Array.from(files).filter(f => f.name.endsWith('.xml'))
    if (lista.length === 0) return

    const novos = lista.map(f => ({ nome: f.name, status: 'aguardando' as const }))
    setArquivos(novos)
    setResumo(null)
    setProcessando(true)

    let importados = 0, erros = 0, duplicados = 0

    for (let i = 0; i < lista.length; i++) {
      const file = lista[i]
      const xmlStr = await file.text()
      const cte = parseXmlCte(xmlStr, file.name)

      if (!cte || !cte.numero_cte) {
        setArquivos(prev => prev.map((a, idx) => idx === i ? { ...a, status: 'erro', erro: 'XML inválido ou formato não reconhecido' } : a))
        erros++
        continue
      }

      // Verificar duplicado pela chave de acesso
      if (cte.chave_acesso) {
        const { data: exist } = await supabase
          .from('ctes')
          .select('id')
          .eq('chave_acesso', cte.chave_acesso)
          .eq('empresa_id', EMPRESA_ID)
          .maybeSingle()

        if (exist) {
          setArquivos(prev => prev.map((a, idx) => idx === i ? { ...a, status: 'duplicado', cte } : a))
          duplicados++
          continue
        }
      }

      // Inserir no banco
      const { error } = await supabase.from('ctes').insert({
        empresa_id:        EMPRESA_ID,
        numero_cte:        cte.numero_cte,
        chave_acesso:      cte.chave_acesso || null,
        tomador_tipo:      cte.tomador_tipo,
        remetente_nome:    cte.remetente_nome || null,
        remetente_cnpj:    cte.remetente_cnpj || null,
        destinatario_nome: cte.destinatario_nome || null,
        destinatario_cnpj: cte.destinatario_cnpj || null,
        tomador_nome:      cte.tomador_nome || null,
        tomador_cnpj:      cte.tomador_cnpj || null,
        uf_origem:         cte.uf_origem || null,
        uf_destino:        cte.uf_destino || null,
        modal:             cte.modal,
        valor_servico:     cte.valor_servico,
        valor_mercadoria:  cte.valor_mercadoria,
        peso_real:         cte.peso_real,
        peso_cubado:       cte.peso_cubado,
        peso_taxado:       cte.peso_taxado,
        data_emissao:      cte.data_emissao || null,
        status:            'Recebido',
      })

      if (error) {
        setArquivos(prev => prev.map((a, idx) => idx === i ? { ...a, status: 'erro', erro: error.message, cte } : a))
        erros++
      } else {
        setArquivos(prev => prev.map((a, idx) => idx === i ? { ...a, status: 'ok', cte } : a))
        importados++
      }
    }

    setResumo({ importados, erros, duplicados })
    setProcessando(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) processarArquivos(e.dataTransfer.files)
  }

  return (
    <div style={{ padding: '16px 20px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: '600', color: '#1A1916', margin: '0 0 4px' }}>
          Importar CT-e via XML
        </h1>
        <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
          Arraste os arquivos XML enviados pelas transportadoras ou clique para selecionar
        </p>
      </div>

      {/* Área de drop */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#185FA5' : '#D4D2CA'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          background: dragging ? '#E6F1FB' : '#FAFAF8',
          cursor: 'pointer',
          transition: 'all .2s',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1916', marginBottom: '4px' }}>
          Arraste os arquivos XML aqui
        </div>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '16px' }}>
          ou clique para selecionar — aceita múltiplos arquivos
        </div>
        <div style={{
          display: 'inline-block', padding: '8px 20px', background: '#185FA5',
          color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '500'
        }}>
          Selecionar arquivos XML
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xml"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && processarArquivos(e.target.files)}
        />
      </div>

      {/* Resumo */}
      {resumo && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px'
        }}>
          <div style={{ background: '#EAF3DE', border: '0.5px solid #B3D48A', borderRadius: '8px', padding: '12px 16px' }}>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#27500A' }}>{resumo.importados}</div>
            <div style={{ fontSize: '12px', color: '#3A6B12' }}>✅ Importados com sucesso</div>
          </div>
          <div style={{ background: '#FAEEDA', border: '0.5px solid #F0C070', borderRadius: '8px', padding: '12px 16px' }}>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#633806' }}>{resumo.duplicados}</div>
            <div style={{ fontSize: '12px', color: '#854F0B' }}>⚠️ Já existiam no sistema</div>
          </div>
          <div style={{ background: '#FCEBEB', border: '0.5px solid #E8AEAE', borderRadius: '8px', padding: '12px 16px' }}>
            <div style={{ fontSize: '22px', fontWeight: '600', color: '#791F1F' }}>{resumo.erros}</div>
            <div style={{ fontSize: '12px', color: '#A32D2D' }}>❌ Erros no processamento</div>
          </div>
        </div>
      )}

      {/* Lista de arquivos */}
      {arquivos.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #E2E0D8', fontSize: '12px', fontWeight: '500', color: '#444441' }}>
            {processando ? '⏳ Processando arquivos...' : `${arquivos.length} arquivo(s) processado(s)`}
          </div>
          {arquivos.map((a, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
              gap: '12px', padding: '10px 16px', borderBottom: '0.5px solid #E2E0D8',
              alignItems: 'center', fontSize: '12px'
            }}>
              <span style={{ fontSize: '16px' }}>
                {a.status === 'aguardando' ? '⏳' : a.status === 'ok' ? '✅' : a.status === 'duplicado' ? '⚠️' : '❌'}
              </span>
              <div>
                <div style={{ fontWeight: '500', color: '#1A1916' }}>{a.nome}</div>
                {a.cte && (
                  <div style={{ color: '#888780', fontSize: '11px' }}>
                    CT-e {a.cte.numero_cte} · {a.cte.remetente_nome} → {a.cte.uf_destino} · R$ {a.cte.valor_servico.toFixed(2)}
                  </div>
                )}
                {a.erro && <div style={{ color: '#A32D2D', fontSize: '11px' }}>{a.erro}</div>}
                {a.status === 'duplicado' && <div style={{ color: '#854F0B', fontSize: '11px' }}>CT-e já importado anteriormente</div>}
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '500',
                background: a.status === 'ok' ? '#EAF3DE' : a.status === 'duplicado' ? '#FAEEDA' : a.status === 'erro' ? '#FCEBEB' : '#F1EFE8',
                color: a.status === 'ok' ? '#27500A' : a.status === 'duplicado' ? '#633806' : a.status === 'erro' ? '#791F1F' : '#888780',
              }}>
                {a.status === 'ok' ? 'Importado' : a.status === 'duplicado' ? 'Duplicado' : a.status === 'erro' ? 'Erro' : 'Aguardando'}
              </span>
              {a.cte && <span style={{ color: '#888780', fontSize: '11px' }}>{a.cte.modal}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
