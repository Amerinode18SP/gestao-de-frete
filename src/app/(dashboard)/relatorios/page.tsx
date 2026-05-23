'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtNum = (v: number) => v.toLocaleString('pt-BR')

interface DadosMes { mes: string; valor: number; count: number }
interface DadosFornecedor { nome: string; valor: number; count: number }
interface DadosCentro { nome: string; valor: number; count: number }

export default function RelatoriosPage() {
  const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? ''
  const router = useRouter()

  const [dataInicio, setDataInicio] = useState('2026-01-01')
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0])
  const [carregando, setCarregando] = useState(true)
  const [porMes, setPorMes] = useState<DadosMes[]>([])
  const [porFornecedor, setPorFornecedor] = useState<DadosFornecedor[]>([])
  const [porCentro, setPorCentro] = useState<DadosCentro[]>([])
  const [totais, setTotais] = useState({ valor: 0, count: 0, media: 0, ticket: 0 })

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = new URLSearchParams({ empresa_id: EMPRESA_ID, data_inicio: dataInicio, data_fim: dataFim })
      const res = await fetch(`/api/relatorios?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPorMes(data.por_mes ?? [])
        setPorFornecedor(data.por_fornecedor ?? [])
        setPorCentro(data.por_centro ?? [])
        setTotais(data.totais ?? { valor: 0, count: 0, media: 0, ticket: 0 })
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [EMPRESA_ID, dataInicio, dataFim])

  useEffect(() => { carregar() }, [carregar])

  const maxMes = Math.max(...porMes.map(m => m.valor), 1)
  const maxForn = Math.max(...porFornecedor.map(f => f.valor), 1)
  const maxCentro = Math.max(...porCentro.map(c => c.valor), 1)
  const totalForn = porFornecedor.reduce((a, f) => a + f.valor, 0)

  const exportarExcel = async () => {
    const params = new URLSearchParams({ empresa_id: EMPRESA_ID, data_inicio: dataInicio, data_fim: dataFim, formato: 'excel' })
    window.open(`/api/relatorios/exportar?${params}`, '_blank')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🚛</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Frete</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/dashboard' }, { label: 'Relatórios', href: '/relatorios' }, { label: 'Alertas', href: '/alertas' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: tab.href === '/relatorios' ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab.href === '/relatorios' ? '#F0EEE8' : '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={exportarExcel} style={{ background: '#1565C0', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          📥 Exportar Excel
        </button>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#888780' }}>Período:</span>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff' }} />
          <span style={{ fontSize: '12px', color: '#888780' }}>até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '12px', background: '#fff' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'Total gasto', valor: fmt(totais.valor), cor: '#2E7D32' },
            { label: 'Média mensal', valor: fmt(totais.media), cor: '#1565C0' },
            { label: 'CTes emitidas', valor: fmtNum(totais.count), cor: '#1A1916' },
            { label: 'Ticket médio', valor: fmt(totais.ticket), cor: '#E65100' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #E8E6E0' }}>
              <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: card.cor }}>{carregando ? '—' : card.valor}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Gastos por mês</div>
          {carregando ? <div style={{ color: '#888', fontSize: '13px' }}>Carregando...</div> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
              {porMes.map(m => (
                <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{fmt(m.valor).replace('R$', '').trim()}</div>
                  <div style={{ width: '100%', background: '#1976D2', borderRadius: '3px 3px 0 0', height: `${Math.max((m.valor / maxMes) * 100, 4)}px` }} />
                  <div style={{ fontSize: '10px', color: '#888' }}>{m.mes}</div>
                </div>
              ))}
              {porMes.length === 0 && <div style={{ color: '#888', fontSize: '13px' }}>Nenhum dado no período</div>}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Por transportadora</div>
            {carregando ? <div style={{ color: '#888', fontSize: '13px' }}>Carregando...</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {porFornecedor.slice(0, 8).map((f, i) => {
                  const cores = ['#1976D2','#2E7D32','#E65100','#7B1FA2','#C62828','#0288D1','#558B2F','#FF6F00']
                  const pct = totalForn > 0 ? ((f.valor / totalForn) * 100).toFixed(1) : '0'
                  return (
                    <div key={f.nome}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                        <span style={{ color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{f.nome || 'Sem nome'}</span>
                        <span style={{ color: '#888', flexShrink: 0 }}>{pct}% — {fmt(f.valor)}</span>
                      </div>
                      <div style={{ background: '#F0EEE8', borderRadius: '99px', height: '6px' }}>
                        <div style={{ background: cores[i % cores.length], width: `${(f.valor / maxForn) * 100}%`, height: '100%', borderRadius: '99px' }} />
                      </div>
                    </div>
                  )
                })}
                {porFornecedor.length === 0 && <div style={{ color: '#888', fontSize: '13px' }}>Nenhum dado</div>}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Por centro de custo</div>
            {carregando ? <div style={{ color: '#888', fontSize: '13px' }}>Carregando...</div> : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
                {porCentro.map((c, i) => {
                  const cores = ['#2E7D32','#1976D2','#E65100','#7B1FA2']
                  return (
                    <div key={c.nome} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ fontSize: '10px', color: '#888' }}>{fmt(c.valor).replace('R$','').trim()}</div>
                      <div style={{ width: '100%', background: cores[i % cores.length], borderRadius: '3px 3px 0 0', height: `${Math.max((c.valor / maxCentro) * 100, 4)}px` }} />
                      <div style={{ fontSize: '10px', color: '#888', textAlign: 'center', wordBreak: 'break-word' }}>{c.nome?.split(' ').slice(0,2).join(' ') || '—'}</div>
                    </div>
                  )
                })}
                {porCentro.length === 0 && <div style={{ color: '#888', fontSize: '13px' }}>Nenhum dado</div>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
