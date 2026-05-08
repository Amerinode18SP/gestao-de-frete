const supabase = require('../supabase')

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseData(valor) {
  if (!valor) return null
  const s = String(valor).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return s.substring(0, 10)
  const p = s.split('/')
  if (p.length === 3 && p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
  return null
}

function diasEntre(inicio, fim) {
  if (!inicio) return null
  const d1 = new Date(inicio + 'T00:00:00')
  const d2 = fim ? new Date(fim + 'T00:00:00') : new Date()
  return Math.max(0, Math.round((d2 - d1) / 86400000))
}

// ── Listar ────────────────────────────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { status, placa, supervisor, localidade, tipo_manutencao,
            data_inicio, data_fim, page = 1, limit = 50 } = req.query

    let query = supabase
      .from('manutencoes')
      .select('*', { count: 'exact' })
      .order('data_entrada', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status)          query = query.eq('status', status)
    if (placa)           query = query.ilike('placa', `%${placa}%`)
    if (supervisor)      query = query.ilike('supervisor', `%${supervisor}%`)
    if (localidade)      query = query.ilike('localidade', `%${localidade}%`)
    if (tipo_manutencao) query = query.eq('tipo_manutencao', tipo_manutencao)
    if (data_inicio)     query = query.gte('data_entrada', data_inicio)
    if (data_fim)        query = query.lte('data_entrada', data_fim)

    const { data, error, count } = await query
    if (error) throw error

    // Adiciona dias_efetivos calculado
    const enriched = (data || []).map(m => ({
      ...m,
      dias_efetivos: diasEntre(m.data_entrada, m.data_saida)
    }))

    res.json({ data: enriched, total: count, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Buscar por ID ─────────────────────────────────────────────────────────────
async function buscarPorId(req, res) {
  try {
    const { data, error } = await supabase
      .from('manutencoes')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Registro não encontrado' })

    res.json({ ...data, dias_efetivos: diasEntre(data.data_entrada, data.data_saida) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Criar ─────────────────────────────────────────────────────────────────────
async function criar(req, res) {
  try {
    const {
      placa, modelo, localidade, supervisor,
      data_entrada, data_saida, previsao_retorno, dias_previstos,
      tipo_manutencao = 'Corretiva',
      veiculo_alugado = false, veiculo_devolvido = false, data_devolucao,
      num_os, status = 'Em Andamento', observacoes
    } = req.body

    if (!placa || !data_entrada)
      return res.status(400).json({ error: 'Placa e data_entrada são obrigatórios.' })

    const payload = {
      placa: placa.toString().toUpperCase().trim(),
      modelo: modelo?.toString().trim() || null,
      localidade: localidade?.toString().trim() || null,
      supervisor: supervisor?.toString().trim() || null,
      data_entrada: parseData(data_entrada),
      data_saida: parseData(data_saida),
      previsao_retorno: parseData(previsao_retorno),
      dias_previstos: dias_previstos ? parseInt(dias_previstos) : null,
      tipo_manutencao,
      veiculo_alugado: Boolean(veiculo_alugado),
      veiculo_devolvido: Boolean(veiculo_devolvido),
      data_devolucao: parseData(data_devolucao),
      num_os: num_os?.toString().trim() || null,
      status,
      observacoes: observacoes?.toString().trim() || null,
      convertido_ordem: false
    }

    const { data, error } = await supabase
      .from('manutencoes')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Atualizar ─────────────────────────────────────────────────────────────────
async function atualizar(req, res) {
  try {
    const campos = [
      'placa','modelo','localidade','supervisor',
      'data_entrada','data_saida','previsao_retorno','dias_previstos',
      'tipo_manutencao','veiculo_alugado','veiculo_devolvido','data_devolucao',
      'num_os','status','observacoes'
    ]

    const payload = {}
    for (const c of campos) {
      if (req.body[c] !== undefined) payload[c] = req.body[c]
    }

    // Normalizar datas
    for (const d of ['data_entrada','data_saida','previsao_retorno','data_devolucao']) {
      if (payload[d] !== undefined) payload[d] = parseData(payload[d])
    }

    if (payload.placa) payload.placa = payload.placa.toString().toUpperCase().trim()

    const { data, error } = await supabase
      .from('manutencoes')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Excluir ───────────────────────────────────────────────────────────────────
async function excluir(req, res) {
  try {
    const { error } = await supabase
      .from('manutencoes')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Registro excluído com sucesso.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Converter em Ordem de Compra ──────────────────────────────────────────────
async function converterEmOrdem(req, res) {
  try {
    // Buscar a manutenção
    const { data: man, error: me } = await supabase
      .from('manutencoes')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (me) throw me
    if (!man) return res.status(404).json({ error: 'Registro não encontrado' })
    if (man.convertido_ordem) return res.status(400).json({ error: 'Já convertido em ordem de compra.' })

    // Dados vindos do body para complementar a ordem
    const {
      fornecedor, cnpj,
      supervisor, nota_fiscal, data_ordem,
      categoria = 'Serviço',
      item, valor_item = 0, quantidade = 1,
      observacao, num_ordem, link_ordem
    } = req.body

    if (!fornecedor || !cnpj || !nota_fiscal || !item)
      return res.status(400).json({ error: 'fornecedor, cnpj, nota_fiscal e item são obrigatórios.' })

    // Upsert veículo
    const veiculoPayload = {
      placa: man.placa,
      localidade: man.localidade || '',
      km_atual: null,
      proxima_revisao: null
    }
    if (man.modelo) veiculoPayload.observacao = `Modelo: ${man.modelo}`

    const { data: v, error: ve } = await supabase
      .from('veiculos')
      .upsert(veiculoPayload, { onConflict: 'placa' })
      .select().single()
    if (ve) throw ve

    // Upsert fornecedor
    const cnpjLimpo = cnpj.toString().replace(/\D/g, '')
    const { data: f, error: fe } = await supabase
      .from('fornecedores')
      .upsert({ razao_social: fornecedor.toString().trim(), cnpj: cnpjLimpo }, { onConflict: 'cnpj' })
      .select().single()
    if (fe) throw fe

    // Criar ordem
    const vi = parseFloat(valor_item) || 0
    const qt = parseInt(quantidade) || 1

    const { data: o, error: oe } = await supabase
      .from('ordens')
      .insert({
        veiculo_id:    v.id,
        fornecedor_id: f.id,
        supervisor:    supervisor || man.supervisor || '',
        num_ordem:     num_ordem || man.num_os || null,
        link_ordem:    link_ordem || null,
        nota_fiscal:   nota_fiscal.toString().trim(),
        data_ordem:    parseData(data_ordem) || new Date().toISOString().split('T')[0],
        categoria,
        item:          item.toString().trim(),
        valor_item:    vi,
        quantidade:    qt,
        valor_total:   vi * qt,
        observacao:    observacao || man.observacoes || null,
        status:        'Pendente',
        origem:        'Manual'
      })
      .select().single()
    if (oe) throw oe

    // Marcar manutenção como convertida
    await supabase
      .from('manutencoes')
      .update({
        convertido_ordem: true,
        ordem_id: o.id,
        status: man.status === 'Em Andamento' ? 'Retornado' : man.status,
        data_saida: man.data_saida || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)

    res.status(201).json({ ordem: o, manutencao_id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Dashboard: resumo ─────────────────────────────────────────────────────────
async function resumoDash(req, res) {
  try {
    const hoje = new Date().toISOString().split('T')[0]

    // Total em andamento
    const { count: emAndamento, error: e1 } = await supabase
      .from('manutencoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Em Andamento')
    if (e1) throw e1

    // Veículos alugados ativos (em andamento + alugado + não devolvido)
    const { count: alugadosAtivos, error: e2 } = await supabase
      .from('manutencoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Em Andamento')
      .eq('veiculo_alugado', true)
      .eq('veiculo_devolvido', false)
    if (e2) throw e2

    // Em atraso (data previsao_retorno < hoje e status Em Andamento)
    const { count: emAtraso, error: e3 } = await supabase
      .from('manutencoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Em Andamento')
      .lt('previsao_retorno', hoje)
    if (e3) throw e3

    // Retornados no mês atual
    const inicioMes = new Date(); inicioMes.setDate(1)
    const inicioMesStr = inicioMes.toISOString().split('T')[0]
    const { count: retornadosMes, error: e4 } = await supabase
      .from('manutencoes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Retornado')
      .gte('data_saida', inicioMesStr)
    if (e4) throw e4

    // Média de dias (em andamento)
    const { data: andamento, error: e5 } = await supabase
      .from('manutencoes')
      .select('data_entrada, data_saida')
      .eq('status', 'Em Andamento')
    if (e5) throw e5

    const mediaDias = andamento?.length
      ? Math.round(andamento.reduce((s, m) => s + diasEntre(m.data_entrada, m.data_saida), 0) / andamento.length)
      : 0

    res.json({ emAndamento, alugadosAtivos, emAtraso, retornadosMes, mediaDias })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Dashboard: rankings ───────────────────────────────────────────────────────
async function rankingsDash(req, res) {
  try {
    const { tipo = 'localidade', limit = 10 } = req.query

    const { data, error } = await supabase
      .from('manutencoes')
      .select('placa, localidade, supervisor, tipo_manutencao, status, data_entrada')

    if (error) throw error

    const map = new Map()
    for (const m of (data || [])) {
      let label
      if (tipo === 'localidade')     label = m.localidade
      else if (tipo === 'supervisor') label = m.supervisor
      else if (tipo === 'tipo')       label = m.tipo_manutencao
      else if (tipo === 'status')     label = m.status
      else if (tipo === 'placa')      label = m.placa
      if (!label) continue
      map.set(label, (map.get(label) || 0) + 1)
    }

    const ranking = [...map.entries()]
      .map(([label, qtd]) => ({ label, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, parseInt(limit) || 10)

    res.json(ranking)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Dashboard: série temporal de entradas ─────────────────────────────────────
async function serieDash(req, res) {
  try {
    const { granularidade = 'mes', data_inicio, data_fim } = req.query

    let query = supabase.from('manutencoes').select('data_entrada, status, tipo_manutencao')
    if (data_inicio) query = query.gte('data_entrada', data_inicio)
    if (data_fim)    query = query.lte('data_entrada', data_fim)

    const { data, error } = await query
    if (error) throw error

    const fmtChave = (dataIso) => {
      if (!dataIso) return null
      const s = String(dataIso).substring(0, 10)
      if (granularidade === 'dia')  return s
      if (granularidade === 'mes')  return s.substring(0, 7)
      if (granularidade === 'ano')  return s.substring(0, 4)
      return s.substring(0, 7)
    }

    const map = new Map()
    for (const m of (data || [])) {
      const k = fmtChave(m.data_entrada)
      if (!k) continue
      const cur = map.get(k) || { total: 0, corretiva: 0, preventiva: 0, outros: 0 }
      cur.total++
      const t = (m.tipo_manutencao || '').toLowerCase()
      if (t === 'corretiva')   cur.corretiva++
      else if (t === 'preventiva' || t === 'revisão') cur.preventiva++
      else cur.outros++
      map.set(k, cur)
    }

    const serie = [...map.entries()]
      .map(([periodo, v]) => ({ periodo, ...v }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo))

    res.json(serie)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  listar, buscarPorId, criar, atualizar, excluir,
  converterEmOrdem,
  resumoDash, rankingsDash, serieDash
}
