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

async function resumo(req, res) {
  try {
    const { periodo = 'mes' } = req.query
    const hoje = new Date()
    let dataInicio

    if (periodo === 'mes') {
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
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

    const inicioStr = dataInicio ? dataInicio.toISOString().split('T')[0] : null

    // Total de ordens e valor no período
    let qOrdens = supabase.from('ordens').select('status, valor_total, data_ordem')
    if (inicioStr) qOrdens = qOrdens.gte('data_ordem', inicioStr)
    const { data: ordens, error: e1 } = await qOrdens
    if (e1) throw e1

    const total_ordens = ordens.length
    const valor_total  = ordens.reduce((s, o) => s + (o.valor_total || 0), 0)

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

    res.json({ total_ordens, valor_total, revisoes_proximas, revisoes_urgentes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  listarVeiculos, revisoesPendentes, atualizarVeiculo,
  listarFornecedores,
  resumo
}
