'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface SyncStatus {
  running: boolean
  pagina: number
  total: number
  importados: number
  atualizados: number
  erro?: string
  concluido: boolean
}

interface ResolverStatus {
  running: boolean
  resolvidos: number
  ainda_pendentes: number
  concluido: boolean
  erro?: string
}

interface Resumo {
  total: number
  faturado: number
  cancelado: number
  pendente: number
  valor_total: number
}

interface Cte {
  id: string
  numero_cte: string
  remetente_nome: string
  fornecedor_nome: string
  destinatario_nome: string
  uf_origem: string
  uf_destino: string
  valor_servico: number
  status: string
  data_emissao: string
  modal: string
  chave_acesso: string
  peso_real: number
  centro_custo_nome: string
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Faturado:   { bg: '#E8F5E9', color: '#2E7D32' },
  Cancelado:  { bg: '#FFEBEE', color: '#C62828' },
  Pendente:   { bg: '#FFF8E1', color: '#E65100' },
  'A vencer': { bg: '#FFF8E1', color: '#E65100' },
}

export default function DashboardPage() {
  const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? ''
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const PAGE_SIZE = 50

  const [resolver, setResolver] = useState<ResolverStatus>({
    running: false, resolvidos: 0, ainda_pendentes: 0, concluido: false
  })
  const [sync, setSync] = useState<SyncStatus>({
    running: false, pagina: 0, total: 0,
    importados: 0, atualizados: 0, concluido: false,
  })
  const [xmlImport, setXmlImport] = useState<{ running: boolean; mensagem: string; erro?: string }>({
    running: false, mensagem: ''
  })
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [ctes, setCtes] = useState<Cte[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [carregando, setCarregando] = useState(true)
  const [menuAberto, setMenuAberto] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCtes, setTotalCtes] = useState(0)
  const [ultimoSync, setUltimoSync] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const carregarCtes = useCallback(async (p = 1, status = 'Todos', q = '', di = '', df = '') => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({
        empresa_id: EMPRESA_ID,
        page: String(p),
        limit: String(PAGE_SIZE),
      })
      if (status !== 'Todos') params.set('status', status === 'A vencer' ? 'Pendente' : status)
      if (q) params.set('busca', q)
      if (di) params.set('data_inicio', di)
      if (df) params.set('data_fim', df)

      const res = await fetch(`/api/ctes?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCtes(data.ctes ?? [])
        setTotalPages(data.total_pages ?? 1)
        setTotalCtes(data.total ?? 0)
        setPage(p)
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [EMPRESA_ID])

  const carregarResumo = useCallback(async (status = 'Todos', q = '', di = '', df = '') => {
    const params = new URLSearchParams({ empresa_id: EMPRESA_ID })
    if (status !== 'Todos') params.set('status', status === 'A vencer' ? 'Pendente' : status)
    if (q) params.set('busca', q)
    if (di) params.set('data_inicio', di)
    if (df) params.set('data_fim', df)
    const res = await fetch(`/api/ctes/resumo?${params}`)
    if (res.ok) setResumo(await res.json())
  }, [EMPRESA_ID])

  const carregarUltimoSync = useCallback(async (forcarData?: string) => {
    if (forcarData) {
      setUltimoSync(forcarData)
      return
    }
    try {
      const res = await fetch(`/api/sync-status?empresa_id=${EMPRESA_ID}`)
      if (res.ok) {
        const data = await res.json()
        if (data.ultimo_sync) setUltimoSync(data.ultimo_sync)
      }
    } catch (e) { console.error(e) }
  }, [EMPRESA_ID])

  useEffect(() => {
    carregarResumo('Todos', '')
    carregarCtes(1, 'Todos', '')
    carregarUltimoSync()
  }, [carregarResumo, carregarCtes, carregarUltimoSync])

  useEffect(() => {
    const t = setTimeout(() => {
      carregarResumo(filtroStatus, busca, dataInicio, dataFim)
      carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    }, 400)
    return () => clearTimeout(t)
  }, [busca, filtroStatus, dataInicio, dataFim, carregarCtes, carregarResumo])


  const verificarAlertas = async () => {
    try {
      await fetch('/api/alertas/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID }),
      })
    } catch (e) { console.error('Erro ao verificar alertas:', e) }
  }

  const iniciarSync = async () => {
    setSync({ running: true, pagina: 1, total: 0, importados: 0, atualizados: 0, concluido: false })
    let pagina = 1
    let totalImportados = 0
    let totalAtualizados = 0
    try {
      while (true) {
        const res = await fetch('/api/omie/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer interno' },
          body: JSON.stringify({ empresa_id: EMPRESA_ID, pagina_inicio: pagina }),
        })
        if (!res.ok) {
          const err = await res.json()
          setSync(s => ({ ...s, running: false, erro: err.error ?? 'Erro no servidor' }))
          return
        }
        const data = await res.json()
        totalImportados  += data.importados ?? 0
        totalAtualizados += data.atualizados ?? 0
        setSync({
          running:     !!data.proxima_pagina,
          pagina:      data.proxima_pagina ?? pagina,
          total:       data.total_paginas ?? 0,
          importados:  totalImportados,
          atualizados: totalAtualizados,
          concluido:   !data.proxima_pagina,
        })
        if (!data.proxima_pagina) break
        pagina = data.proxima_pagina
        await new Promise(r => setTimeout(r, 500))
      }
      await carregarResumo(filtroStatus, busca, dataInicio, dataFim)
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
      await carregarUltimoSync(new Date().toISOString()) // Força data atual
      // Auto-preencher transportadoras e centros de custo após sync
      await resolverTransportadoras()
      // Verificar alertas após sync
      await verificarAlertas()
    } catch (e: any) {
      setSync(s => ({ ...s, running: false, erro: e.message }))
    }
  }

  const resolverTransportadoras = async () => {
    setResolver({ running: true, resolvidos: 0, ainda_pendentes: 0, concluido: false })
    let totalResolvidos = 0
    const MAX_TENTATIVAS = 20
    try {
      for (let tentativa = 0; tentativa < MAX_TENTATIVAS; tentativa++) {
        const res = await fetch('/api/omie/resolver-transportadoras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer interno' },
          body: JSON.stringify({ empresa_id: EMPRESA_ID }),
        })
        if (!res.ok) {
          const err = await res.json()
          setResolver(s => ({ ...s, running: false, erro: err.error ?? 'Erro' }))
          return
        }
        const data = await res.json()
        totalResolvidos += data.resolvidos ?? 0
        setResolver({
          running:         data.tem_mais ?? false,
          resolvidos:      totalResolvidos,
          ainda_pendentes: data.ainda_pendentes ?? 0,
          concluido:       !data.tem_mais,
        })
        if (!data.tem_mais) break
        if ((data.resolvidos ?? 0) === 0) break
        await new Promise(r => setTimeout(r, 800))
      }
      setResolver(s => ({ ...s, running: false, concluido: true }))
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    } catch (e: any) {
      setResolver(s => ({ ...s, running: false, erro: e.message }))
    }
  }

  const importarXml = async (arquivo: File) => {
    setXmlImport({ running: true, mensagem: 'Processando XMLs...' })
    try {
      const formData = new FormData()
      formData.append('empresa_id', EMPRESA_ID)
      formData.append('arquivo', arquivo)
      const res = await fetch('/api/xml/importar', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer interno' },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao importar')
      setXmlImport({ running: false, mensagem: data.message })
      await carregarCtes(1, filtroStatus, busca, dataInicio, dataFim)
    } catch (e: any) {
      setXmlImport({ running: false, mensagem: '', erro: e.message })
    }
  }

  const progresso = sync.total > 0 ? Math.round((sync.pagina / sync.total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8', letterSpacing: '-0.3px' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/dashboard' }, { label: 'Mapeamento', href: '/mapeamento' }, { label: 'Relatórios', href: '/relatorios' }, { label: 'Alertas', href: '/alertas' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: tab.href === '/dashboard' ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab.href === '/dashboard' ? '#F0EEE8' : '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {ultimoSync && (
            <span style={{ fontSize: '11px', color: '#888', background: '#2a2a2a', padding: '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
              🕐 Último sync: {new Date(ultimoSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {isAdmin && (
            <>
              <label style={{ background: xmlImport.running ? '#555' : '#1565C0', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: xmlImport.running ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {xmlImport.running ? '⟳ Importando...' : '📂 Importar XMLs'}
                <input type="file" accept=".zip" style={{ display: 'none' }} disabled={xmlImport.running} onChange={e => { const f = e.target.files?.[0]; if (f) importarXml(f); e.target.value = ''; }} />
              </label>
              <button onClick={resolverTransportadoras} disabled={resolver.running || sync.running}
                style={{ background: resolver.running ? '#555' : resolver.concluido ? '#1B5E20' : '#7B1FA2', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: resolver.running ? 'not-allowed' : 'pointer' }}>
                {resolver.running ? `⟳ Resolvendo... (${resolver.resolvidos})` : resolver.concluido ? `✅ ${resolver.resolvidos} resolvidas` : '🔍 Preencher Transportadoras'}
              </button>
              <button onClick={iniciarSync} disabled={sync.running || resolver.running}
                style={{ background: sync.running ? '#333' : '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: sync.running ? 'not-allowed' : 'pointer' }}>
                {sync.running ? `⟳ Sincronizando... ${sync.pagina}/${sync.total}` : sync.concluido ? '✅ Sincronizado' : '🔄 Sincronizar CTes'}
              </button>
            </>
          )}
          <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#F0EEE8', fontSize: '12px' }}
          >
            <span>👤</span>
            <span>{perfil?.nome || perfil?.email?.split('@')[0] || 'Usuário'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
          </button>
          {menuAberto && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: '10px', border: '1px solid #E8E6E0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1916' }}>{perfil?.nome || 'Usuário'}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{perfil?.email}</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', background: perfil?.papel === 'administrador' ? '#E6F1FB' : '#EAF3DE', color: perfil?.papel === 'administrador' ? '#0C447C' : '#27500A', padding: '2px 8px', borderRadius: '99px', fontWeight: '500' }}>
                    {perfil?.papel === 'administrador' ? '👑 Administrador' : '👁️ Visualizador'}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    👥 Gerenciar usuários
                  </button>
                  <button onClick={() => { setMenuAberto(false); router.push('/configuracoes') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}
                  >
                    ⚙️ Configurações
                  </button>
                </>
              )}
              <button onClick={sair}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F0EEE8' }}
                onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                🚪 Sair
              </button>
            </div>
          )}
        </div>
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

        {(sync.running || sync.concluido || sync.erro) && (
          <div style={{ background: sync.erro ? '#FFEBEE' : sync.concluido ? '#E8F5E9' : '#E3F2FD', border: `1px solid ${sync.erro ? '#FFCDD2' : sync.concluido ? '#C8E6C9' : '#BBDEFB'}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
            {sync.erro ? <p style={{ margin: 0, color: '#C62828', fontSize: '14px' }}>❌ Erro: {sync.erro}</p>
            : sync.concluido ? <p style={{ margin: 0, color: '#2E7D32', fontSize: '14px' }}>✅ Sync concluído — <strong>{sync.importados} novos</strong>, {sync.atualizados} atualizados.</p>
            : <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#1565C0' }}>Buscando página {sync.pagina} de {sync.total || '?'} — {sync.importados} CTes importadas</span>
                  <span style={{ fontSize: '13px', color: '#1565C0', fontWeight: '600' }}>{progresso}%</span>
                </div>
                <div style={{ background: '#BBDEFB', borderRadius: '99px', height: '6px' }}>
                  <div style={{ background: '#1976D2', width: `${progresso}%`, height: '100%', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                </div>
              </div>}
          </div>
        )}

        {(resolver.running || resolver.concluido || resolver.erro) && (
          <div style={{ background: resolver.erro ? '#FFEBEE' : resolver.concluido ? '#F3E5F5' : '#EDE7F6', border: `1px solid ${resolver.erro ? '#FFCDD2' : '#CE93D8'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px' }}>
            {resolver.erro ? <p style={{ margin: 0, color: '#C62828', fontSize: '14px' }}>❌ Erro: {resolver.erro}</p>
            : resolver.concluido ? <p style={{ margin: 0, color: '#6A1B9A', fontSize: '14px' }}>✅ {resolver.resolvidos} transportadoras preenchidas{resolver.ainda_pendentes > 0 ? ` — ${resolver.ainda_pendentes} sem nome` : '!'}</p>
            : <p style={{ margin: 0, color: '#6A1B9A', fontSize: '14px' }}>🔍 Buscando transportadoras... {resolver.resolvidos} resolvidas</p>}
          </div>
        )}

        {(xmlImport.running || xmlImport.mensagem || xmlImport.erro) && (
          <div style={{ background: xmlImport.erro ? '#FFEBEE' : '#E3F2FD', border: `1px solid ${xmlImport.erro ? '#FFCDD2' : '#BBDEFB'}`, borderRadius: '12px', padding: '14px 20px', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: xmlImport.erro ? '#C62828' : '#1565C0', fontSize: '14px' }}>
              {xmlImport.erro ? `❌ Erro: ${xmlImport.erro}` : xmlImport.running ? '⟳ Processando XMLs...' : `✅ ${xmlImport.mensagem}`}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total de CTes', valor: resumo?.total ?? '—', icon: '📦', cor: '#1A1916' },
            { label: 'Valor Total', valor: resumo ? fmt(resumo.valor_total) : '—', icon: '💰', cor: '#2E7D32' },
            { label: 'Faturadas', valor: resumo?.faturado ?? '—', icon: '🟢', cor: '#2E7D32' },
            { label: 'A vencer', valor: resumo?.pendente ?? '—', icon: '🟡', cor: '#E65100' },
            { label: 'Canceladas', valor: resumo?.cancelado ?? '—', icon: '🔴', cor: '#C62828' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #E8E6E0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>{card.icon}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: card.cor, letterSpacing: '-0.5px' }}>
                {carregando && !resumo ? <span style={{ color: '#ccc' }}>—</span> : card.valor}
              </div>
              <div style={{ fontSize: '12px', color: '#888780', marginTop: '4px' }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Buscar por número, transportadora ou destinatário..."
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ flex: '1', minWidth: '240px', padding: '9px 14px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }} />
          {['Todos', 'Faturado', 'A vencer', 'Cancelado'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: filtroStatus === s ? '#1A1916' : '#D8D6D0', background: filtroStatus === s ? '#1A1916' : '#fff', color: filtroStatus === s ? '#fff' : '#555', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>{s}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#888780', whiteSpace: 'nowrap' }}>Data de Emissão:</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff', outline: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', color: '#888780' }}>até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff', outline: 'none', cursor: 'pointer' }} />
            {(dataInicio || dataFim) && (
              <button onClick={() => { setDataInicio(''); setDataFim('') }}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', background: '#fff', color: '#888', fontSize: '12px', cursor: 'pointer' }}>✕ Limpar</button>
            )}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>CT-es</span>
            <span style={{ fontSize: '12px', color: '#888780' }}>{totalCtes.toLocaleString('pt-BR')} registros no total</span>
          </div>
          {carregando ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888780', fontSize: '14px' }}>Carregando CTes...</div>
          ) : ctes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888780', fontSize: '14px' }}>
              {totalCtes === 0 ? 'Nenhuma CT-e. Clique em "Sincronizar CTes" para importar.' : 'Nenhuma CT-e corresponde aos filtros.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8F7F4' }}>
                    {['Nº CT-e', 'Transportadora', 'Destinatário', 'Origem → Destino', 'Modal', 'Peso (kg)', 'Centro de Custo', 'Valor', 'Emissão', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctes.map((c, i) => {
                    const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.Pendente
                    const transportadora = c.fornecedor_nome || c.remetente_nome || '—'
                    const origem = c.uf_origem || '?'
                    const destino = c.uf_destino || '?'
                    return (
                      <tr key={c.id} style={{ borderTop: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={{ padding: '10px 16px', fontWeight: '600' }}>{c.numero_cte ?? '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#444', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{transportadora}</td>
                        <td style={{ padding: '10px 16px', color: '#444', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.destinatario_nome || '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#666', whiteSpace: 'nowrap' }}>{origem} → {destino}</td>
                        <td style={{ padding: '10px 16px', color: '#666' }}>{c.modal ?? '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#666', whiteSpace: 'nowrap' }}>{c.peso_real ? c.peso_real.toLocaleString('pt-BR') : '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#666', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>{c.centro_custo_nome || '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#2E7D32', whiteSpace: 'nowrap' }}>{c.valor_servico != null ? fmt(c.valor_servico) : '—'}</td>
                        <td style={{ padding: '10px 16px', color: '#666', whiteSpace: 'nowrap' }}>{c.data_emissao ? new Date(c.data_emissao).toLocaleDateString('pt-BR') : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>{c.status === 'Pendente' ? 'A vencer' : c.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#888780' }}>Página {page} de {totalPages}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => carregarCtes(page - 1, filtroStatus, busca, dataInicio, dataFim)} disabled={page === 1} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === 1 ? '#f5f5f5' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>← Anterior</button>
                <button onClick={() => carregarCtes(page + 1, filtroStatus, busca, dataInicio, dataFim)} disabled={page === totalPages} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #D8D6D0', background: page === totalPages ? '#f5f5f5' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: '13px' }}>Próxima →</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input:focus { border-color: #1A1916 !important; box-shadow: 0 0 0 2px rgba(26,25,22,0.1); }
      `}</style>
    </div>
  )
}
