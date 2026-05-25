'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID || '22c8f1e1-3aa7-4794-a76b-fc1d4041b0ca'

interface Usuario {
  id: string
  nome: string
  email: string
  papel: 'administrador' | 'visualizador'
  ativo: boolean
  criado_em: string
}

const PAPEL_COR: Record<string, { bg: string; color: string }> = {
  administrador: { bg: '#E6F1FB', color: '#0C447C' },
  visualizador:  { bg: '#EAF3DE', color: '#27500A' },
}

export default function UsuariosPage() {
  const router = useRouter()
  const { isAdmin, perfil, sair } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novoPapel, setNovoPapel] = useState<'administrador' | 'visualizador'>('visualizador')
  const [enviando, setEnviando] = useState(false)
  const [reenviando, setReenviando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch(`/api/usuarios?empresa_id=${EMPRESA_ID}`)
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data.usuarios ?? [])
      }
    } catch (e) { console.error(e) }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro('')
    setMensagem('')
    try {
      const res = await fetch('/api/usuarios/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: novoEmail, nome: novoNome, papel: novoPapel, empresa_id: EMPRESA_ID })
      })
      const data = await res.json()
      if (res.ok) {
        setMensagem(`✅ Convite enviado para ${novoEmail}!`)
        setNovoEmail(''); setNovoNome(''); setNovoPapel('visualizador')
        setModalAberto(false)
        carregar()
      } else {
        setErro(data.error || 'Erro ao convidar usuário')
      }
    } catch { setErro('Erro de conexão') }
    setEnviando(false)
  }

  async function reenviarConvite(u: Usuario) {
    setReenviando(u.id)
    setErro('')
    setMensagem('')
    try {
      const res = await fetch('/api/usuarios/convidar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, nome: u.nome, papel: u.papel, empresa_id: EMPRESA_ID })
      })
      const data = await res.json()
      if (res.ok) {
        setMensagem(`✅ Convite reenviado para ${u.email}!`)
      } else {
        setErro(data.error || 'Erro ao reenviar convite')
      }
    } catch { setErro('Erro de conexão') }
    setReenviando(null)
  }

  async function alterarPapel(id: string, papel: string) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, papel })
    })
    carregar()
  }

  async function alterarAtivo(id: string, ativo: boolean) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ativo })
    })
    carregar()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0EEE8', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#1A1916' }}>
      {/* Header */}
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
                    {perfil?.papel === 'administrador' ? '👑 Administrador' : '👁 Visualizador'}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => { setMenuAberto(false); router.push('/usuarios') }}
                  style={{ width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#1A1916', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#F8F7F4')}
                  onMouseOut={e => (e.currentTarget.style.background = 'none')}
                >
                  👥 Gerenciar usuários
                </button>
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
      </header>

      <main style={{ padding: '28px 32px', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px' }}>Usuários</h1>
            <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>Gerencie acessos e perfis da equipe</p>
          </div>
          {isAdmin && (
            <button onClick={() => { setModalAberto(true); setErro(''); setMensagem('') }}
              style={{ background: '#1A1916', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              + Convidar usuário
            </button>
          )}
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

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E8E6E0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EEE8', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Membros da equipe</span>
            <span style={{ fontSize: '12px', color: '#888780' }}>{usuarios.length} usuário(s)</span>
          </div>

          {carregando ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Carregando...</div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Nenhum usuário cadastrado.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8F7F4' }}>
                  {['Usuário', 'Email', 'Papel', 'Status', ...(isAdmin ? ['Ações'] : [])].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#555', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => {
                  const cor = PAPEL_COR[u.papel] || PAPEL_COR.visualizador
                  const isSelf = u.id === perfil?.id
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid #F0EEE8', background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                        {u.nome} {isSelf && <span style={{ fontSize: '10px', color: '#888', background: '#F0EEE8', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>você</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...cor, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500' }}>
                          {u.papel === 'administrador' ? '👑 Administrador' : '👁 Visualizador'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: u.ativo ? '#EAF3DE' : '#F1EFE8', color: u.ativo ? '#27500A' : '#888', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500' }}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{ padding: '12px 16px' }}>
                          {!isSelf && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <select
                                value={u.papel}
                                onChange={e => alterarPapel(u.id, e.target.value)}
                                style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid #D8D6D0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
                              >
                                <option value="administrador">Administrador</option>
                                <option value="visualizador">Visualizador</option>
                              </select>
                              <button onClick={() => alterarAtivo(u.id, !u.ativo)}
                                style={{ padding: '4px 10px', fontSize: '11px', border: `1px solid ${u.ativo ? '#E8AEAE' : '#D4D2CA'}`, borderRadius: '6px', background: '#fff', cursor: 'pointer', color: u.ativo ? '#791F1F' : '#444' }}>
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button
                                onClick={() => reenviarConvite(u)}
                                disabled={reenviando === u.id}
                                style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #C7D2FE', borderRadius: '6px', background: '#F0F4FF', cursor: reenviando === u.id ? 'not-allowed' : 'pointer', color: '#4f46e5', fontWeight: '500' }}>
                                {reenviando === u.id ? 'Enviando...' : '✉ Reenviar convite'}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal convidar */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '420px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Convidar usuário</h2>
              <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>×</button>
            </div>

            <form onSubmit={convidar}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '5px' }}>Nome</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} required placeholder="Nome completo"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '5px' }}>Email</label>
                <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} required placeholder="email@empresa.com"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D8D6D0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Perfil de acesso</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { valor: 'administrador', label: '👑 Administrador', desc: 'Acesso total' },
                    { valor: 'visualizador', label: '👁 Visualizador', desc: 'Só leitura' },
                  ].map(p => (
                    <div key={p.valor} onClick={() => setNovoPapel(p.valor as any)}
                      style={{ padding: '12px', border: `1.5px solid ${novoPapel === p.valor ? '#1A1916' : '#E2E0D8'}`, borderRadius: '8px', cursor: 'pointer', background: novoPapel === p.valor ? '#F8F7F4' : '#fff', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', marginBottom: '2px' }}>{p.label}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalAberto(false)}
                  style={{ padding: '9px 16px', fontSize: '13px', border: '1px solid #D8D6D0', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviando}
                  style={{ padding: '9px 16px', fontSize: '13px', fontWeight: '600', background: enviando ? '#888' : '#1A1916', color: '#fff', border: 'none', borderRadius: '8px', cursor: enviando ? 'not-allowed' : 'pointer' }}>
                  {enviando ? 'Enviando...' : 'Enviar convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
