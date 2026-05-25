'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface StateData { name: string; uf: string; ctes: number; value: number; modal: string }
interface ChartItem { label: string; value: number }
interface Summary { totalValue: number; totalCtes: number; stateCount: number; ticketMedio: number; topState: StateData | null }
interface MapData { summary: Summary; byState: StateData[]; byModal: ChartItem[]; byCC: ChartItem[]; transportadoras: string[]; centrosCusto: string[] }

const BLUE_STOPS = ['#dbeafe','#93c5fd','#3b82f6','#1d4ed8','#1e3a8a']
const MODAL_COLORS: Record<string,string> = { Rodoviário:'#1a56a0', Aéreo:'#2d8a60', Marítimo:'#b5742a' }
const CC_COLORS: Record<string,string> = {}

const BRAZIL_PATHS: Record<string,{path:string;cx:number;cy:number}> = {
  AC:{path:'M 52 228 L 60 220 L 74 218 L 86 224 L 94 230 L 96 240 L 88 248 L 76 250 L 62 248 L 52 238 Z',cx:74,cy:234},
  AM:{path:'M 96 120 L 114 108 L 148 104 L 176 112 L 196 108 L 214 116 L 222 132 L 218 152 L 208 168 L 196 180 L 186 196 L 170 206 L 154 210 L 136 214 L 120 208 L 104 202 L 92 188 L 88 172 L 88 156 L 92 140 Z',cx:155,cy:158},
  RR:{path:'M 148 64 L 162 52 L 176 48 L 192 52 L 200 68 L 196 88 L 182 96 L 168 100 L 154 96 L 146 84 Z',cx:174,cy:74},
  PA:{path:'M 196 108 L 214 96 L 234 88 L 260 86 L 284 92 L 300 104 L 306 120 L 298 138 L 286 152 L 270 162 L 252 168 L 236 170 L 218 166 L 208 154 L 208 138 L 214 124 L 208 116 Z',cx:255,cy:128},
  AP:{path:'M 282 64 L 298 56 L 312 62 L 316 78 L 308 90 L 294 92 L 282 84 Z',cx:299,cy:75},
  RO:{path:'M 120 208 L 136 214 L 154 218 L 162 228 L 156 242 L 144 250 L 128 252 L 114 246 L 106 234 L 108 222 Z',cx:134,cy:230},
  TO:{path:'M 270 162 L 286 160 L 298 170 L 302 186 L 296 202 L 284 212 L 270 216 L 256 212 L 248 200 L 250 184 L 260 172 Z',cx:275,cy:189},
  MA:{path:'M 298 104 L 316 98 L 332 96 L 348 102 L 354 116 L 348 132 L 334 140 L 318 140 L 302 132 L 296 118 Z',cx:325,cy:118},
  PI:{path:'M 348 102 L 362 100 L 376 108 L 380 124 L 372 138 L 358 142 L 344 136 L 340 122 L 346 110 Z',cx:360,cy:120},
  CE:{path:'M 376 100 L 392 98 L 404 108 L 402 124 L 390 132 L 376 128 L 372 116 Z',cx:388,cy:114},
  RN:{path:'M 404 96 L 416 98 L 420 110 L 412 116 L 402 112 Z',cx:411,cy:106},
  PB:{path:'M 396 116 L 410 118 L 416 128 L 408 134 L 396 130 Z',cx:406,cy:124},
  PE:{path:'M 370 128 L 396 128 L 410 136 L 406 148 L 390 152 L 372 148 L 362 140 Z',cx:386,cy:139},
  AL:{path:'M 396 148 L 408 150 L 410 160 L 400 164 L 390 158 Z',cx:400,cy:156},
  SE:{path:'M 386 158 L 398 162 L 398 172 L 388 174 L 382 166 Z',cx:390,cy:166},
  BA:{path:'M 302 134 L 328 136 L 354 138 L 376 148 L 390 160 L 396 178 L 390 196 L 374 210 L 354 218 L 332 222 L 310 220 L 290 212 L 276 200 L 278 186 L 290 174 L 298 160 L 298 146 Z',cx:335,cy:180},
  MG:{path:'M 276 198 L 298 212 L 316 218 L 338 222 L 354 216 L 372 210 L 386 222 L 390 238 L 382 254 L 366 262 L 346 266 L 324 264 L 302 256 L 286 244 L 278 230 L 278 214 Z',cx:332,cy:234},
  ES:{path:'M 386 222 L 400 226 L 406 240 L 400 252 L 388 256 L 380 246 L 382 234 Z',cx:393,cy:238},
  RJ:{path:'M 366 262 L 384 258 L 398 264 L 402 276 L 392 284 L 376 282 L 364 274 Z',cx:383,cy:272},
  SP:{path:'M 278 230 L 300 252 L 320 264 L 346 266 L 360 278 L 356 296 L 340 304 L 318 302 L 296 292 L 276 278 L 264 264 L 266 248 L 272 238 Z',cx:313,cy:271},
  PR:{path:'M 264 264 L 284 278 L 302 290 L 320 302 L 334 308 L 332 322 L 316 330 L 296 330 L 274 320 L 256 306 L 250 290 L 256 276 Z',cx:291,cy:300},
  SC:{path:'M 256 308 L 280 322 L 298 330 L 310 338 L 304 350 L 288 354 L 268 346 L 252 334 L 248 320 Z',cx:280,cy:332},
  RS:{path:'M 248 320 L 270 348 L 286 356 L 296 368 L 284 382 L 264 384 L 244 374 L 228 358 L 226 342 L 234 328 Z',cx:262,cy:354},
  MS:{path:'M 210 248 L 236 246 L 256 254 L 264 268 L 258 286 L 244 294 L 224 292 L 206 280 L 202 266 Z',cx:233,cy:269},
  MT:{path:'M 154 218 L 178 214 L 202 212 L 224 218 L 240 234 L 240 254 L 228 266 L 210 268 L 190 260 L 170 246 L 156 234 Z',cx:197,cy:239},
  GO:{path:'M 248 198 L 268 196 L 284 206 L 290 222 L 284 238 L 268 244 L 250 242 L 236 230 L 234 216 L 242 206 Z',cx:263,cy:219},
  DF:{path:'M 272 218 L 280 216 L 284 222 L 278 226 L 272 224 Z',cx:278,cy:221},
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function getColor(value: number, maxVal: number): string {
  if (!value || maxVal === 0) return '#e5e7eb'
  return BLUE_STOPS[Math.min(4, Math.floor(Math.pow(value / maxVal, 0.6) * 5))]
}
function getIdx(value: number, maxVal: number): number {
  if (!value || maxVal === 0) return -1
  return Math.min(4, Math.floor(Math.pow(value / maxVal, 0.6) * 5))
}

function BrazilMap({ byState }: { byState: StateData[] }) {
  const [tooltip, setTooltip] = useState<{text:string;x:number;y:number}|null>(null)
  const sm = Object.fromEntries(byState.map(d => [d.uf, d]))
  const maxVal = Math.max(...byState.map(d => d.value), 1)
  return (
    <div style={{position:'relative'}}>
      <svg viewBox="0 0 420 480" style={{width:'100%',display:'block'}}>
        {Object.entries(BRAZIL_PATHS).map(([uf, pd]) => {
          const d = sm[uf]
          return (
            <g key={uf} style={{cursor:d?'pointer':'default'}}
              onMouseEnter={e => d && setTooltip({text:d.name+' ('+uf+')\n'+fmt(d.value)+' · '+d.ctes+' CT-es\nModal: '+d.modal,x:(e as any).clientX,y:(e as any).clientY})}
              onMouseMove={e => tooltip && setTooltip(t => t?{...t,x:(e as any).clientX,y:(e as any).clientY}:null)}
              onMouseLeave={() => setTooltip(null)}>
              <path d={pd.path} fill={d?getColor(d.value,maxVal):'#e5e7eb'} stroke="#fff" strokeWidth={1}/>
              <text x={pd.cx} y={pd.cy+3} textAnchor="middle" fontSize={uf==='DF'?5:9} fontWeight={500}
                fill={d&&getIdx(d.value,maxVal)>=3?'#fff':'#374151'} pointerEvents="none">{uf}</text>
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <div style={{position:'fixed',left:tooltip.x+12,top:tooltip.y-10,background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px',fontSize:12,lineHeight:1.6,pointerEvents:'none',zIndex:999,whiteSpace:'pre-line',boxShadow:'0 2px 8px rgba(0,0,0,.1)'}}>
          {tooltip.text}
        </div>
      )}
    </div>
  )
}

function BarChart({ items, colorMap }: { items: ChartItem[]; colorMap: Record<string,string> }) {
  if (!items.length) return <p style={{fontSize:13,color:'#888',padding:'1rem 0'}}>—</p>
  const maxV = Math.max(...items.map(i => i.value))
  return (
    <div>
      {items.map(item => {
        const pct = Math.round(item.value/maxV*100)
        const color = colorMap[item.label] || '#1a56a0'
        return (
          <div key={item.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:'#888',width:92,flexShrink:0,textAlign:'right',lineHeight:1.3}}>{item.label}</span>
            <div style={{flex:1,background:'#f3f4f6',borderRadius:3,height:22,overflow:'hidden'}}>
              <div style={{width:pct+'%',height:'100%',borderRadius:3,background:color+'20',borderLeft:'3px solid '+color,display:'flex',alignItems:'center',paddingLeft:7}}>
                <span style={{fontSize:11,fontWeight:500,color,whiteSpace:'nowrap'}}>{fmt(item.value)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Gera cor consistente por label
function labelColor(label: string): string {
  const palette = ['#1a56a0','#2d8a60','#b5742a','#884cb5','#c0392b','#16a085','#d35400','#2980b9']
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

export default function MapeamentoPage() {
  const router = useRouter()
  const { perfil, sair } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)
  const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID!
  const [data, setData] = useState<MapData|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [modal, setModal] = useState('all')
  const [transportadora, setTransportadora] = useState('all')
  const [centroCusto, setCentroCusto] = useState('all')
  const [mes, setMes] = useState('all')
  const [ano, setAno] = useState('all')
  const [transportadoras, setTransportadoras] = useState<string[]>([])
  const [centrosCusto, setCentrosCusto] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams({empresa_id: empresaId})
      if (modal !== 'all') p.set('modal', modal)
      if (transportadora !== 'all') p.set('transportadora', transportadora)
      if (centroCusto !== 'all') p.set('centro_custo', centroCusto)
      if (mes !== 'all') p.set('mes', mes)
      if (ano !== 'all') p.set('ano', ano)
      const res = await fetch('/api/remessas/mapeamento?' + p)
      if (!res.ok) throw new Error(await res.text())
      const json: MapData = await res.json()
      setData(json)
      setTransportadoras(json.transportadoras || [])
      setCentrosCusto(json.centrosCusto || [])
    } catch(e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [empresaId, modal, transportadora, centroCusto, mes, ano])

  useEffect(() => { fetchData() }, [fetchData])

  const s = data?.summary
  const selStyle = { width:'100%', fontSize:12, padding:'7px 10px', border:'1px solid #D8D6D0', borderRadius:8, background:'#fff', color:'#1A1916', cursor:'pointer' } as const
  const cardStyle = { background:'#fff', border:'1px solid #E8E6E0', borderRadius:12, padding:'1rem', opacity: loading ? 0.6 : 1, transition:'opacity .2s' } as const

  return (
    <div style={{minHeight:'100vh', background:'#F0EEE8', fontFamily:"'DM Sans', system-ui, sans-serif", color:'#1A1916'}}>

      {/* Header */}
      <header style={{background:'#1A1916', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <span style={{fontSize:'20px'}}>🚛</span>
          <span style={{fontSize:'15px', fontWeight:'600', color:'#F0EEE8', letterSpacing:'-0.3px'}}>Gestão de Log</span>
        </div>
        <div style={{display:'flex', gap:'4px'}}>
          {[{label:'CT-e',href:'/dashboard'},{label:'Mapeamento',href:'/mapeamento'},{label:'Relatórios',href:'/relatorios'},{label:'Alertas',href:'/alertas'}].map(tab => (
            <button key={tab.href} onClick={() => router.push(tab.href)}
              style={{padding:'5px 12px', borderRadius:'6px', fontSize:'12px', border:'none', cursor:'pointer',
                background: tab.href === '/mapeamento' ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tab.href === '/mapeamento' ? '#F0EEE8' : '#888'}}>
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{position:'relative'}}>
          <button onClick={() => setMenuAberto(m => !m)}
            style={{display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.08)', border:'1px solid #333', borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:'#F0EEE8', fontSize:'12px'}}>
            <span>👤</span>
            <span>{perfil?.nome || perfil?.email?.split('@')[0] || 'Usuário'}</span>
            <span style={{fontSize:'10px', opacity:0.6}}>▾</span>
          </button>
          {menuAberto && (
            <div style={{position:'absolute', right:0, top:'110%', background:'#fff', borderRadius:'10px', border:'1px solid #E8E6E0', boxShadow:'0 8px 24px rgba(0,0,0,.12)', minWidth:'180px', zIndex:200, overflow:'hidden'}}>
              <div style={{padding:'12px 16px', borderBottom:'1px solid #F0EEE8'}}>
                <div style={{fontSize:'12px', fontWeight:'600', color:'#1A1916'}}>{perfil?.nome || 'Usuário'}</div>
                <div style={{fontSize:'11px', color:'#888', marginTop:'2px'}}>{perfil?.email}</div>
              </div>
              <button onClick={() => { setMenuAberto(false); sair() }}
                style={{width:'100%', padding:'10px 16px', textAlign:'left', background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'#C62828', borderTop:'1px solid #F0EEE8'}}
                onMouseOver={e => (e.currentTarget.style.background='#FFF5F5')}
                onMouseOut={e => (e.currentTarget.style.background='none')}>
                🚪 Sair
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main style={{padding:'1.5rem 2rem', maxWidth:1400, margin:'0 auto'}}>

        {/* Filtros */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:'1.25rem'}}>
          <select value={modal} onChange={e => setModal(e.target.value)} style={selStyle}>
            <option value="all">Todos os modais</option>
            <option value="Rodoviário">Rodoviário</option>
            <option value="Aéreo">Aéreo</option>
            <option value="Marítimo">Marítimo</option>
          </select>
          <select value={transportadora} onChange={e => setTransportadora(e.target.value)} style={selStyle}>
            <option value="all">Todas as transportadoras</option>
            {transportadoras.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={centroCusto} onChange={e => setCentroCusto(e.target.value)} style={selStyle}>
            <option value="all">Todos os C.C.</option>
            {centrosCusto.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={mes} onChange={e => setMes(e.target.value)} style={selStyle}>
            <option value="all">Todos os meses</option>
            {MESES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(e.target.value)} style={selStyle}>
            <option value="all">Todo o período</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>

        {error && <div style={{padding:'1rem', background:'#FFEBEE', color:'#C62828', borderRadius:8, marginBottom:'1rem', fontSize:13}}>Erro: {error}</div>}

        {/* KPIs */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:'1.25rem'}}>
          {[
            {label:'VALOR TOTAL REMESSAS', value: s ? fmt(s.totalValue) : '—', sub: s ? s.totalCtes+' CT-es · '+s.stateCount+' estados' : '—'},
            {label:'TICKET MÉDIO / CT-E', value: s ? fmt(s.ticketMedio) : '—', sub:'por documento'},
            {label:'ESTADO DE MAIOR GASTO', value: s?.topState?.name || '—', sub: s?.topState ? fmt(s.topState.value) : '—'},
          ].map(c => (
            <div key={c.label} style={{background:'#fff', borderRadius:8, padding:'1rem 1.25rem', border:'1px solid #E8E6E0', opacity: loading ? 0.5 : 1, transition:'opacity .2s'}}>
              <div style={{fontSize:11, fontWeight:500, letterSpacing:'.06em', color:'#888', textTransform:'uppercase', marginBottom:6}}>{c.label}</div>
              <div style={{fontSize:26, fontWeight:600, color:'#1A1916', lineHeight:1.15}}>{c.value}</div>
              <div style={{fontSize:12, color:'#888', marginTop:3}}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Mapa + Ranking */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', background:'#fff', border:'1px solid #E8E6E0', borderRadius:12, overflow:'hidden', marginBottom:'1.25rem'}}>
          <div style={{padding:'1rem', borderRight:'1px solid #F0EEE8'}}>
            <div style={{fontSize:12, color:'#888', marginBottom:'.75rem'}}>📍 Gasto por estado de destino</div>
            {loading
              ? <div style={{height:300, display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontSize:13}}>Carregando...</div>
              : <BrazilMap byState={data?.byState || []} />}
            <div style={{display:'flex', alignItems:'center', gap:8, marginTop:'.5rem', fontSize:11, color:'#888'}}>
              <span>Menor</span>
              <div style={{display:'flex', height:7, flex:1, borderRadius:4, overflow:'hidden'}}>
                {BLUE_STOPS.map(c => <div key={c} style={{flex:1, background:c}} />)}
              </div>
              <span>Maior</span>
            </div>
          </div>
          <div style={{padding:'1rem'}}>
            <div style={{fontSize:12, color:'#888', marginBottom:'.75rem'}}>🏆 Top 8 estados por valor</div>
            {loading ? <div style={{color:'#888', fontSize:13}}>Carregando...</div>
              : (data?.byState || []).slice(0, 8).map(d => {
                const maxV = data?.byState[0]?.value || 1
                const pct = Math.round(d.value / maxV * 100)
                return (
                  <div key={d.uf} style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                    <span style={{fontSize:12, fontWeight:500, width:28, color:'#888', textAlign:'right', flexShrink:0}}>{d.uf}</span>
                    <div style={{flex:1, background:'#f3f4f6', borderRadius:3, height:24, overflow:'hidden'}}>
                      <div style={{width:pct+'%', height:'100%', borderRadius:3, background:'#dbeafe', display:'flex', alignItems:'center', paddingLeft:8}}>
                        <span style={{fontSize:11, fontWeight:500, color:'#1a56a0', whiteSpace:'nowrap'}}>{fmt(d.value)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Gráficos */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:'1.25rem'}}>
          <div style={cardStyle}>
            <div style={{fontSize:12, color:'#888', marginBottom:'.75rem'}}>🚛 Gasto por modal</div>
            <BarChart items={data?.byModal || []} colorMap={MODAL_COLORS} />
          </div>
          <div style={cardStyle}>
            <div style={{fontSize:12, color:'#888', marginBottom:'.75rem'}}>📋 Por centro de custo</div>
            <BarChart items={(data?.byCC || []).slice(0,8)} colorMap={Object.fromEntries((data?.byCC || []).map(i => [i.label, labelColor(i.label)]))} />
          </div>
        </div>

        {/* Tabela */}
        <div style={{background:'#fff', border:'1px solid #E8E6E0', borderRadius:12, overflow:'hidden'}}>
          <div style={{padding:'.75rem 1rem', borderBottom:'1px solid #F0EEE8', fontSize:13, fontWeight:600}}>📊 Detalhamento por estado</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:13}}>
              <thead>
                <tr style={{background:'#F8F7F4'}}>
                  {['#','Estado','UF','CT-es','Modal predom.','Valor total','Ticket médio','Participação'].map((h, i) => (
                    <th key={h} style={{padding:'8px 16px', textAlign: i >= 3 ? 'right' : 'left', fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', borderBottom:'1px solid #F0EEE8', whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8} style={{padding:'2rem', textAlign:'center', color:'#888'}}>Carregando...</td></tr>
                  : !(data?.byState?.length)
                    ? <tr><td colSpan={8} style={{padding:'2rem', textAlign:'center', color:'#888'}}>Nenhum resultado para os filtros selecionados</td></tr>
                    : (data?.byState || []).map((d, i) => {
                        const total = s?.totalValue || 1
                        const pct = Math.round(d.value / total * 100)
                        const ticket = d.ctes > 0 ? Math.round(d.value / d.ctes) : 0
                        return (
                          <tr key={d.uf} style={{borderTop:'1px solid #F0EEE8', background: i%2===0?'#fff':'#FAFAF8'}}>
                            <td style={{padding:'9px 16px'}}>
                              <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:'50%', background:'#F0EEE8', fontSize:11, fontWeight:600}}>{i+1}</span>
                            </td>
                            <td style={{padding:'9px 16px'}}>{d.name}</td>
                            <td style={{padding:'9px 16px', color:'#888'}}>{d.uf}</td>
                            <td style={{padding:'9px 16px', textAlign:'right'}}>{d.ctes}</td>
                            <td style={{padding:'9px 16px', textAlign:'right'}}>
                              <span style={{display:'inline-block', fontSize:11, padding:'2px 8px', borderRadius:20, background:'#E3F2FD', color:'#1565C0'}}>{d.modal}</span>
                            </td>
                            <td style={{padding:'9px 16px', textAlign:'right', fontWeight:600}}>{fmt(d.value)}</td>
                            <td style={{padding:'9px 16px', textAlign:'right'}}>{fmt(ticket)}</td>
                            <td style={{padding:'9px 16px', textAlign:'right'}}>
                              <div style={{display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end'}}>
                                <div style={{width:56, height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden', flexShrink:0}}>
                                  <div style={{width:pct+'%', height:'100%', borderRadius:3, background:'#1a56a0'}} />
                                </div>
                                <span style={{fontSize:11, minWidth:28}}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                }
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
