'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ConfiguracoesPage() {
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const [params, setParams] = useState({
    limite_semanal: 45000,
    limite_mensal: 180000,
    limite_fornecedor_mes: 60000,
    tolerancia_pct: 5,
    email_alertas: '',
    frequencia_relatorio: 'Mensal',
  })

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/alertas/parametros?empresa_id=${EMPRESA_ID}`)
    if (res.ok) {
      const data = await res.json()
      if (data.parametros) {
        setParams({
          limite_semanal:        data.parametros.limite_semanal ?? 45000,
          limite_mensal:         data.parametros.limite_mensal ?? 180000,
          limite_fornecedor_mes: data.parametros.limite_fornecedor_mes ?? 60000,
          tolerancia_pct:        data.parametros.tolerancia_pct ?? 5,
          email_alertas:         data.parametros.email_alertas ?? '',
          frequencia_relatorio:  data.parametros.frequencia_relatorio ?? 'Mensal',
        })
      }
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setMensagem('')
    setErro('')
    try {
      const res = await fetch('/api/alertas/parametros', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: EMPRESA_ID, ...params })
      })
      if (res.ok) {
        setMensagem('✅ Configurações salvas com sucesso!')
      } else {
        const data = await res.json()
        setErro(data.error || 'Erro ao salvar')
      }
    } catch { setErro('Erro de conexão') }
    setSalvando(false)
  }

  const campo = (label: string, key: keyof typeof params, tipo: 'moeda' | 'pct' | 'text' | 'email' | 'select', opcoes?: string[]) => (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>{label}</label>
      {tipo === 'select' ? (
        <select
          value={params[key] as string}
          onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', background: '#fff', outline: 'none' }}
        >
          {opcoes?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <div style={{ position: 'relative' }}>
          {tipo === 'moeda' && <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '13px' }}>R$</span>}
          {tipo === 'pct' && <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888', fontSize: '13px' }}>%</span>}
          <input
            type={tipo === 'email' ? 'email' : 'number'}
            value={params[key] as string | number}
            onChange={e => setParams(p => ({ ...p, [key]: tipo === 'text' || tipo === 'email' ? e.target.value : Number(e.target.value) }))}
            style={{
              width: '100%', padding: `10px ${tipo === 'pct' ? '36px' : '12px'} 10px ${tipo === 'moeda' ? '36px' : '12px'}`,
              borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      <header style={{ background: '#1A1916', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#F0EEE8' }}>Gestão de Log</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ label: 'CT-e', href: '/dashboard' }, { label: 'Mapeamento', href: '/mapeamento' }, { label: 'Relatórios', href: '/relatorios' }, { label: 'Alertas', href: '/alertas' }].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#888' }}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', color: '#F0EEE8', fontSize: '12px' }}>
            <span>👤</span>
            <span>{perfil?.nome || 'Usuário'}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>▼</span>
          </button>
          {menuAberto && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', borderRadius: '10px', border: '1px solid #E8E6E0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0EEE8' }}>
                <div style={{ fontSize: '12px', fontWeight: '600' }}>{perfil?.nome}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{perfil?.email}</div>
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                    onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                    👥 Gerenciar usuários
                  </button>
                  <button onClick={() => { setMenuAberto(false); router.push('/configuracoes') }}
                    style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: '#F8F7F4', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', fontWeight: '600' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#F0EEE8')}
                    onMouseOut={e => (e.currentTarget.style.background = '#F8F7F4')}>
                    ⚙️ Configurações
                  </button>
                </>
              )}
              <button onClick={sair}
                style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#C62828', borderTop: '1px solid #F0EEE8' }}
                onMouseOver={e => (e.currentTarget.style.background = '#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>⚙️ Configurações</h1>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>Defina os limites e parâmetros de alerta do sistema</p>
        </div>

        <form onSubmit={salvar}>
          {/* Limites de gastos */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💰 Limites de gasto
            </h2>
            {campo('Limite semanal', 'limite_semanal', 'moeda')}
            {campo('Limite mensal total', 'limite_mensal', 'moeda')}
            {campo('Limite por transportadora/mês', 'limite_fornecedor_mes', 'moeda')}
            <div style={{ background: '#F8F7F4', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#666' }}>
              💡 Valores atuais: Semanal {fmt(params.limite_semanal)} · Mensal {fmt(params.limite_mensal)} · Por transportadora {fmt(params.limite_fornecedor_mes)}
            </div>
          </div>

          {/* Tolerância */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎯 Tolerância e notificações
            </h2>
            {campo('Tolerância antes do alerta', 'tolerancia_pct', 'pct')}
            <p style={{ fontSize: '12px', color: '#888', margin: '-12px 0 20px' }}>
              Ex: com limite R$ 45.000 e tolerância 5%, alerta dispara em R$ 47.250
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#444441', display: 'block', marginBottom: '6px' }}>
                Emails para alertas
              </label>
              <textarea
                value={params.email_alertas}
                onChange={e => setParams(p => ({ ...p, email_alertas: e.target.value }))}
                placeholder="ana@empresa.com, joao@empresa.com"
                rows={2}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>Separe múltiplos emails com vírgula.</div>
              {params.email_alertas && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {params.email_alertas.split(',').map(e => e.trim()).filter(Boolean).map((email, i) => (
                    <span key={i} style={{ background: '#E6F1FB', color: '#0C447C', padding: '2px 10px', borderRadius: '99px', fontSize: '11px' }}>✉️ {email}</span>
                  ))}
                </div>
              )}
            </div>
            {campo('Frequência do relatório', 'frequencia_relatorio', 'select', ['Diário', 'Semanal', 'Mensal'])}
          </div>

          {mensagem && (
            <div style={{ background: '#EAF3DE', border: '1px solid #B3D48A', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#27500A' }}>
              {mensagem}
            </div>
          )}
          {erro && (
            <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#C62828' }}>
              {erro}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => router.back()}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #D8D6D0', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#444' }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: salvando ? '#888' : '#1A1916', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : '💾 Salvar configurações'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
