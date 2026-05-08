const supabase = require('../supabase')

// ── VEÍCULOS ─────────────────────────────────────────────────────────────────

async function listarVeiculos(req, res) {
  try {
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .order('placa')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function revisoesPendentes(req, res) {
  try {
    const hoje  = new Date().toISOString().split('T')[0]
    const limit = parseInt(req.query.dias) || 30
    const ate   = new Date()
    ate.setDate(ate.getDate() + limit)
    const ateStr = ate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .lte('proxima_revisao', ateStr)
      .gte('proxima_revisao', hoje)
      .order('proxima_revisao')

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── FORNECEDORES ─────────────────────────────────────────────────────────────

async function atualizarVeiculo(req, res) {
  try {
    const { data, error } = await supabase
      .from('veiculos')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function listarFornecedores(req, res) {
  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('razao_social')
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

function calcularInicio(periodo) {
  const hoje = new Date()
  let dataInicio
  if (periodo === 'mes') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  } else if (periodo === 'mes_ant') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  } else if (periodo === '3m') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
  } else if (periodo === '6m') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
  } else if (periodo === 'trim') {
    const q = Math.floor(hoje.getMonth() / 3)
    dataInicio = new Date(hoje.getFullYear(), q * 3, 1)
  } else if (periodo === 'ano') {
    dataInicio = new Date(hoje.getFullYear(), 0, 1)
  }
  return dataInicio ? dataInicio.toISOString().split('T')[0] : null
}

function calcularFim(periodo) {
  if (periodo !== 'mes_ant') return null
  const hoje = new Date()
  const ult = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
  return ult.toISOString().split('T')[0]
}

// Calcula intervalo do período IMEDIATAMENTE anterior, mesma duração.
// Útil para comparativo "atual vs anterior".
function calcularPeriodoAnterior(periodo) {
  const hoje = new Date()
  const y = hoje.getFullYear(), m = hoje.getMonth()
  let inicio, fim
  if (periodo === 'mes') {
    inicio = new Date(y, m - 1, 1)
    fim    = new Date(y, m, 0)
  } else if (periodo === 'mes_ant') {
    inicio = new Date(y, m - 2, 1)
    fim    = new Date(y, m - 1, 0)
  } else if (periodo === '3m') {
    inicio = new Date(y, m - 5, 1)
    fim    = new Date(y, m - 2, 0)
  } else if (periodo === '6m') {
    inicio = new Date(y, m - 11, 1)
    fim    = new Date(y, m - 5, 0)
  } else if (periodo === 'trim') {
    const q = Math.floor(m / 3)
    inicio = new Date(y, (q - 1) * 3, 1)
    fim    = new Date(y, q * 3, 0)
  } else if (periodo === 'ano') {
    inicio = new Date(y - 1, 0, 1)
    fim    = new Date(y - 1, 11, 31)
  } else {
    return { inicio: null, fim: null }
  }
  return {
    inicio: inicio.toISOString().split('T')[0],
    fim:    fim.toISOString().split('T')[0]
  }
}

async function resumo(req, res) {
  try {
    const { periodo = 'mes', comparar = '0' } = req.query
    const hoje = new Date()
    const inicioStr = calcularInicio(periodo)
    const fimStr    = calcularFim(periodo)

    // Total de ordens e valor no período
    let qOrdens = supabase.from('ordens').select('status, valor_total, data_ordem')
    if (inicioStr) qOrdens = qOrdens.gte('data_ordem', inicioStr)
    if (fimStr)    qOrdens = qOrdens.lte('data_ordem', fimStr)
    const { data: ordens, error: e1 } = await qOrdens
    if (e1) throw e1

    const total_ordens = ordens.length
    const valor_total  = ordens.reduce((s, o) => s + (o.valor_total || 0), 0)

    // Comparativo com período anterior (mesma duração)
    let comparativo = null
    if (comparar === '1' && periodo !== 'todos') {
      const ant = calcularPeriodoAnterior(periodo)
      if (ant.inicio && ant.fim) {
        const { data: ordensAnt, error: eAnt } = await supabase
          .from('ordens').select('valor_total')
          .gte('data_ordem', ant.inicio)
          .lte('data_ordem', ant.fim)
        if (!eAnt) {
          const tAntCount = ordensAnt.length
          const tAntValor = ordensAnt.reduce((s, o) => s + (o.valor_total || 0), 0)
          const tAntTicket = tAntCount > 0 ? tAntValor / tAntCount : 0
          const ticket = total_ordens > 0 ? valor_total / total_ordens : 0
          const delta = (atual, ant) => {
            if (!ant) return atual ? 100 : 0
            return ((atual - ant) / ant) * 100
          }
          comparativo = {
            inicio: ant.inicio,
            fim:    ant.fim,
            total_ordens: tAntCount,
            valor_total:  tAntValor,
            ticket:       tAntTicket,
            delta_total_ordens: delta(total_ordens, tAntCount),
            delta_valor_total:  delta(valor_total, tAntValor),
            delta_ticket:       delta(ticket, tAntTicket)
          }
        }
      }
    }

    // Revisões próximas (30 dias)
    const em30 = new Date(); em30.setDate(em30.getDate() + 30)
    const { count: revisoes_proximas, error: e2 } = await supabase
      .from('veiculos')
      .select('*', { count: 'exact', head: true })
      .lte('proxima_revisao', em30.toISOString().split('T')[0])
      .gte('proxima_revisao', hoje.toISOString().split('T')[0])
    if (e2) throw e2

    // Revisões urgentes (≤ 10 dias)
    const em10 = new Date(); em10.setDate(em10.getDate() + 10)
    const { count: revisoes_urgentes, error: e3 } = await supabase
      .from('veiculos')
      .select('*', { count: 'exact', head: true })
      .lte('proxima_revisao', em10.toISOString().split('T')[0])
      .gte('proxima_revisao', hoje.toISOString().split('T')[0])
    if (e3) throw e3

    res.json({ total_ordens, valor_total, revisoes_proximas, revisoes_urgentes, comparativo })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Rankings de gastos (placa, localidade, item, fornecedor, supervisor, categoria) ──
async function rankings(req, res) {
  try {
    const { tipo = 'placa', periodo = 'mes', limit = 10 } = req.query
    const inicioStr = calcularInicio(periodo)
    const fimStr    = calcularFim(periodo)

    let query = supabase
      .from('ordens')
      .select(`
        valor_total, item, supervisor, categoria, status,
        veiculo:veiculos(placa, localidade),
        fornecedor:fornecedores(razao_social)
      `)
    if (inicioStr) query = query.gte('data_ordem', inicioStr)
    if (fimStr)    query = query.lte('data_ordem', fimStr)

    const { data, error } = await query
    if (error) throw error

    const map = new Map()
    for (const o of (data || [])) {
      let label
      if (tipo === 'placa')          label = o.veiculo?.placa
      else if (tipo === 'localidade') label = o.veiculo?.localidade
      else if (tipo === 'item')       label = o.item
      else if (tipo === 'fornecedor') label = o.fornecedor?.razao_social
      else if (tipo === 'supervisor') label = o.supervisor
      else if (tipo === 'categoria')  label = o.categoria
      else if (tipo === 'status')     label = o.status
      if (!label) continue
      const cur = map.get(label) || { total: 0, qtd: 0 }
      cur.total += Number(o.valor_total || 0)
      cur.qtd   += 1
      map.set(label, cur)
    }

    const ranking = [...map.entries()]
      .map(([label, v]) => ({ label, total: Number(v.total.toFixed(2)), qtd: v.qtd }))
      .sort((a, b) => b.total - a.total)
      .slice(0, parseInt(limit) || 10)

    res.json(ranking)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Série temporal de gastos (granularidade dia/semana/mes/ano) ──────────────
async function serie(req, res) {
  try {
    const { periodo = 'ano', granularidade = 'mes' } = req.query
    const inicioStr = calcularInicio(periodo)
    const fimStr    = calcularFim(periodo)

    let query = supabase.from('ordens').select('data_ordem, valor_total, categoria')
    if (inicioStr) query = query.gte('data_ordem', inicioStr)
    if (fimStr)    query = query.lte('data_ordem', fimStr)

    const { data, error } = await query
    if (error) throw error

    const fmtChave = (dataIso) => {
      if (!dataIso) return null
      const s = String(dataIso).substring(0, 10)
      if (granularidade === 'dia')   return s
      if (granularidade === 'mes')   return s.substring(0, 7)        // YYYY-MM
      if (granularidade === 'ano')   return s.substring(0, 4)        // YYYY
      if (granularidade === 'semana') {
        const d = new Date(s + 'T00:00:00')
        const day = d.getDay()
        d.setDate(d.getDate() - day)
        return d.toISOString().split('T')[0]
      }
      return s
    }

    const map = new Map()
    for (const o of (data || [])) {
      const k = fmtChave(o.data_ordem)
      if (!k) continue
      const cur = map.get(k) || { total: 0, servico: 0, produto: 0, qtd: 0 }
      const v = Number(o.valor_total || 0)
      cur.total += v
      cur.qtd   += 1
      if (o.categoria === 'Serviço') cur.servico += v
      else if (o.categoria === 'Produto') cur.produto += v
      map.set(k, cur)
    }

    const serie = [...map.entries()]
      .map(([periodo, v]) => ({
        periodo,
        total:   Number(v.total.toFixed(2)),
        servico: Number(v.servico.toFixed(2)),
        produto: Number(v.produto.toFixed(2)),
        qtd:     v.qtd
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))

    res.json(serie)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  listarVeiculos, revisoesPendentes, atualizarVeiculo,
  listarFornecedores,
  resumo, rankings, serie
}
