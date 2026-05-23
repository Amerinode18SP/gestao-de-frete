'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Alerta { id: string; tipo: string; mensagem: string; valor: number; limite: number; criado_em: string }

export default function AlertasPage() {
  const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? ''
  const router = useRouter()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [gastoSemana, setGastoSemana] = useState(0)
  const [limiteSemana, setLimiteSemana] = useState(0)
  const [gastoMes, setGastoMes] = useState(0)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch(`/api/alertas?empresa_id=${EMPRESA_ID}`)
      if (res.ok) {
        const data = await res.json()
        setAlertas(data.alertas ?? [])
        setGastoSemana(data.gasto_semana ?? 0)
        setLimiteSemana(data.limite_semana ?? 0)
        setGastoMes(data.gasto_mes ?? 0)
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [EMPRESA_ID])

  useEffect(() => { carregar() }, [carregar])

  const pctSemana = limiteSemana > 0 ? Math.min((gastoSemana / limiteSemana) * 100, 100) : 0
  const corBarra = pctSemana >= 100 ? '#C62828' : pctSemana >= 75 ? '#E65100' : '#2E7D32'

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
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: tab.href === '/alertas' ? 'rgba(255,255,255,0.12)' : 'transparent', color: tab.href === '/alertas' ? '#F0EEE8' : '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div />
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #E8E6E0' }}>
            <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>Gasto esta semana</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: corBarra }}>{fmt(gastoSemana)}</div>
            <div style={{ marginTop: '8px', background: '#F0EEE8', borderRadius: '99px', height: '6px' }}>
              <div style={{ background: corBarra, width: `${pctSemana}%`, height: '100%', borderRadius: '99px' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>{pctSemana.toFixed(0)}% do limite {fmt(limiteSemana)}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #E8E6E0' }}>
            <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>Gasto este mês</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1A1916' }}>{fmt(gastoMes)}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #E8E6E0' }}>
            <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>Alertas ativos</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: alertas.length > 0 ? '#C62828' : '#2E7D32' }}>{alertas.length}</div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0EEE8' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Histórico de alertas</span>
          </div>
          {carregando ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Carregando...</div>
          ) : alertas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>✅ Nenhum alerta — tudo dentro dos limites!</div>
          ) : alertas.map(a => (
            <div key={a.id} style={{ padding: '14px 20px', borderBottom: '1px solid #F0EEE8', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '18px', marginTop: '2px' }}>{a.tipo === 'semanal' ? '⚠️' : a.tipo === 'fornecedor' ? '🔴' : 'ℹ️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#1A1916', marginBottom: '2px' }}>{a.mensagem}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{new Date(a.criado_em).toLocaleString('pt-BR')}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
