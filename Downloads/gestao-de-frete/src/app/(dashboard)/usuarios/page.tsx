'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/client'

const MODULOS = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'cte',           label: 'CT-e' },
  { key: 'solicitacoes',  label: 'Solicitações' },
  { key: 'mapa',          label: 'Mapa Logístico' },
  { key: 'contingencia',  label: 'Contingência' },
  { key: 'relatorios',    label: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'sync',          label: 'Sincronização' },
]

const PAPEL_CORES: Record<string, { bg: string; color: string }> = {
  administrador: { bg: '#E6F1FB', color: '#0C447C' },
  operador:      { bg: '#EAF3DE', color: '#27500A' },
  visualizador:  { bg: '#F1EFE8', color: '#444441' },
}

const PERMISSOES_PADRAO: Record<string, Record<string, boolean>> = {
  administrador: { ver: true,  criar: true,  editar: true,  exportar: true  },
  operador:      { ver: true,  criar: true,  editar: true,  exportar: false },
  visualizador:  { ver: true,  criar: false, editar: false, exportar: false },
}

export default function UsuariosPage() {
  const supabase = createSupabaseBrowser()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Formulário novo usuário
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState('operador')
  const [permissoes, setPermissoes] = useState<Record<string, Record<string, boolean>>>({})

  useEffect(() => { carregarUsuarios() }, [])

  async function carregarUsuarios() {
    const { data } = await supabase.from('vw_usuarios_completo').select('*')
    setUsuarios(data || [])
  }

  function abrirModal(usuario?: any) {
    if (usuario) {
      setEditando(usuario)
      setNome(usuario.nome)
      setEmail(usuario.email)
      setPapel(usuario.papel)
      setPermissoes(usuario.permissoes || {})
    } else {
      setEditando(null)
      setNome(''); setEmail(''); setPapel('operador')
      const perms: Record<string, Record<string, boolean>> = {}
      MODULOS.forEach(m => { perms[m.key] = { ...PERMISSOES_PADRAO['operador'] } })
      setPermissoes(perms)
    }
    setModalAberto(true)
  }

  function mudarPapel(novoPapel: string) {
    setPapel(novoPapel)
    const perms: Record<string, Record<string, boolean>> = {}
    MODULOS.forEach(m => {
      const mod = m.key
      perms[mod] = {
        ver:      novoPapel === 'administrador' ? true  : novoPapel === 'operador' ? ['dashboard','cte','solicitacoes','mapa','relatorios'].includes(mod) : ['dashboard','mapa'].includes(mod),
        criar:    novoPapel === 'administrador' ? true  : novoPapel === 'operador' ? ['cte','solicitacoes'].includes(mod) : false,
        editar:   novoPapel === 'administrador' ? true  : novoPapel === 'operador' ? ['cte','solicitacoes'].includes(mod) : false,
        exportar: novoPapel === 'administrador' ? true  : novoPapel === 'operador' ? ['dashboard','relatorios'].includes(mod) : false,
      }
    })
    setPermissoes(perms)
  }

  function togglePermissao(modulo: string, tipo: string) {
    setPermissoes(prev => ({
      ...prev,
      [modulo]: { ...prev[modulo], [tipo]: !prev[modulo]?.[tipo] }
    }))
  }

  async function convidarUsuario() {
    setLoading(true)
    // Aqui chamaria a API de convite — por ora mostra confirmação
    await new Promise(r => setTimeout(r, 800))
    setModalAberto(false)
    setLoading(false)
    alert(`Convite enviado para ${email}!`)
  }

  async function toggleAtivo(usuario: any) {
    await supabase.from('perfis_usuario')
      .update({ ativo: !usuario.ativo })
      .eq('id', usuario.id)
    carregarUsuarios()
  }

  return (
    <div style={{ padding: '16px 20px', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: '600', color: '#1A1916', margin: '0 0 2px' }}>Usuários</h1>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>Gerencie acessos e permissões da equipe</p>
        </div>
        <button onClick={() => abrirModal()} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
          background: '#185FA5', color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: '500', cursor: 'pointer'
        }}>
          + Convidar usuário
        </button>
      </div>

      {/* Lista */}
      <div style={{ background: '#fff', border: '0.5px solid #E2E0D8', borderRadius: '12px', overflow: 'hidden' }}>
        {usuarios.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>
            Nenhum usuário cadastrado ainda.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid #E2E0D8' }}>
                {['Usuário','Papel','Acesso aos módulos','Status','Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: '#888780', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const cor = PAPEL_CORES[u.papel] || PAPEL_CORES.visualizador
                const modulosAtivos = u.permissoes
                  ? Object.entries(u.permissoes).filter(([, p]: any) => p.ver).map(([k]) => k)
                  : []
                return (
                  <tr key={u.id} style={{ borderBottom: '0.5px solid #E2E0D8' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500', color: '#1A1916' }}>{u.nome}</div>
                      <div style={{ fontSize: '11px', color: '#888780' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...cor, padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '500', display: 'inline-block' }}>
                        {u.papel.charAt(0).toUpperCase() + u.papel.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '280px' }}>
                        {modulosAtivos.slice(0, 4).map(m => (
                          <span key={m} style={{ background: '#F1EFE8', color: '#444441', padding: '2px 7px', borderRadius: '4px', fontSize: '10px' }}>
                            {MODULOS.find(x => x.key === m)?.label || m}
                          </span>
                        ))}
                        {modulosAtivos.length > 4 && (
                          <span style={{ background: '#F1EFE8', color: '#888780', padding: '2px 7px', borderRadius: '4px', fontSize: '10px' }}>
                            +{modulosAtivos.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: u.ativo ? '#EAF3DE' : '#F1EFE8',
                        color: u.ativo ? '#27500A' : '#888780',
                        padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '500'
                      }}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => abrirModal(u)} style={{
                          padding: '4px 10px', fontSize: '11px', border: '0.5px solid #D4D2CA',
                          borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#444441'
                        }}>Editar</button>
                        <button onClick={() => toggleAtivo(u)} style={{
                          padding: '4px 10px', fontSize: '11px',
                          border: `0.5px solid ${u.ativo ? '#E8AEAE' : '#D4D2CA'}`,
                          borderRadius: '6px', background: '#fff', cursor: 'pointer',
                          color: u.ativo ? '#791F1F' : '#444441'
                        }}>{u.ativo ? 'Desativar' : 'Ativar'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '560px',
            maxHeight: '90vh', overflow: 'auto', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#1A1916', margin: 0 }}>
                {editando ? 'Editar usuário' : 'Convidar usuário'}
              </h2>
              <button onClick={() => setModalAberto(false)} style={{
                background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888780'
              }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '4px' }}>Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '0.5px solid #D4D2CA', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '4px' }}>E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@empresa.com"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '0.5px solid #D4D2CA', borderRadius: '6px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Papel */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '8px' }}>Perfil de acesso</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                {(['administrador','operador','visualizador'] as const).map(p => {
                  const cor = PAPEL_CORES[p]
                  return (
                    <div key={p} onClick={() => mudarPapel(p)} style={{
                      padding: '10px', border: `1.5px solid ${papel === p ? '#185FA5' : '#E2E0D8'}`,
                      borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                      background: papel === p ? '#E6F1FB' : '#fff'
                    }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                        {p === 'administrador' ? '👑' : p === 'operador' ? '⚙️' : '👁️'}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: papel === p ? '#0C447C' : '#444441' }}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Permissões por módulo */}
            {papel !== 'administrador' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#444441', display: 'block', marginBottom: '8px' }}>
                  Personalizar permissões
                </label>
                <div style={{ border: '0.5px solid #E2E0D8', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4,auto)', gap: 0, background: '#F5F4F0', padding: '6px 12px', fontSize: '11px', color: '#888780', fontWeight: '500' }}>
                    <span>Módulo</span>
                    {['Ver','Criar','Editar','Exportar'].map(t => <span key={t} style={{ width: '52px', textAlign: 'center' }}>{t}</span>)}
                  </div>
                  {MODULOS.map(m => (
                    <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4,auto)', gap: 0, padding: '8px 12px', borderTop: '0.5px solid #E2E0D8', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#1A1916' }}>{m.label}</span>
                      {(['ver','criar','editar','exportar'] as const).map(t => (
                        <div key={t} style={{ width: '52px', textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={permissoes[m.key]?.[t] || false}
                            onChange={() => togglePermissao(m.key, t)}
                            style={{ cursor: 'pointer', width: '14px', height: '14px' }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModalAberto(false)} style={{
                padding: '8px 16px', fontSize: '13px', border: '0.5px solid #D4D2CA',
                borderRadius: '8px', background: '#fff', cursor: 'pointer', color: '#444441'
              }}>Cancelar</button>
              <button onClick={convidarUsuario} disabled={loading} style={{
                padding: '8px 16px', fontSize: '13px', fontWeight: '500',
                background: loading ? '#85B7EB' : '#185FA5', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? 'Enviando...' : editando ? 'Salvar alterações' : 'Enviar convite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
