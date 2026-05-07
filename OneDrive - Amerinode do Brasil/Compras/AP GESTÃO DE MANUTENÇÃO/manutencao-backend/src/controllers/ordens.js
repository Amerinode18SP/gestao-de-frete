const supabase = require('../supabase')

// ── Listar ordens (com filtros) ───────────────────────────────────────────────
async function listar(req, res) {
  try {
    const { status, categoria, placa, supervisor, origem, num_ordem, item,
            data_inicio, data_fim, page = 1, limit = 50 } = req.query

    let query = supabase
      .from('ordens')
      .select(`
        *,
        veiculo:veiculos(placa, localidade, km_atual, proxima_revisao),
        fornecedor:fornecedores(razao_social, cnpj)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (status)      query = query.eq('status', status)
    if (categoria)   query = query.eq('categoria', categoria)
    if (origem)      query = query.eq('origem', origem)
    if (placa)       query = query.ilike('veiculos.placa', `%${placa}%`)
    if (num_ordem)   query = query.ilike('num_ordem', `%${num_ordem}%`)
    if (item)        query = query.ilike('item', `%${item}%`)
    if (data_inicio) query = query.gte('data_ordem', data_inicio)
    if (data_fim)    query = query.lte('data_ordem', data_fim)

    const { data, error, count } = await query
    if (error) throw error

    res.json({ data, total: count, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Buscar ordem por ID ──────────────────────────────────────────────────────
async function buscarPorId(req, res) {
  try {
    const { data, error } = await supabase
      .from('ordens')
      .select(`*, veiculo:veiculos(*), fornecedor:fornecedores(*)`)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Ordem não encontrada' })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Criar ordem ──────────────────────────────────────────────────────────────
async function criar(req, res) {
  try {
    const {
      // veículo
      placa, localidade, km_atual, proxima_revisao,
      // fornecedor
      fornecedor, cnpj,
      // ordem
      supervisor, num_ordem, link_ordem, nota_fiscal,
      data_ordem, categoria, item, valor_item, quantidade,
      status = 'Pendente', origem = 'Manual'
    } = req.body

    // 1. Upsert veículo
    const { data: veiculoData, error: veiculoErr } = await supabase
      .from('veiculos')
      .upsert({ placa: placa.toUpperCase(), localidade, km_atual, proxima_revisao },
               { onConflict: 'placa' })
      .select()
      .single()
    if (veiculoErr) throw veiculoErr

    // 2. Upsert fornecedor
    const { data: fornecedorData, error: fornecedorErr } = await supabase
      .from('fornecedores')
      .upsert({ razao_social: fornecedor, cnpj: cnpj.replace(/\D/g, '') },
               { onConflict: 'cnpj' })
      .select()
      .single()
    if (fornecedorErr) throw fornecedorErr

    // 3. Inserir ordem
    const valor_total = (parseFloat(valor_item) || 0) * (parseInt(quantidade) || 1)

    const { data: ordemData, error: ordemErr } = await supabase
      .from('ordens')
      .insert({
        veiculo_id:    veiculoData.id,
        fornecedor_id: fornecedorData.id,
        supervisor, num_ordem, link_ordem, nota_fiscal,
        data_ordem, categoria, item,
        valor_item: parseFloat(valor_item) || 0,
        quantidade: parseInt(quantidade) || 1,
        valor_total,
        status, origem
      })
      .select()
      .single()
    if (ordemErr) throw ordemErr

    res.status(201).json(ordemData)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Atualizar ordem ──────────────────────────────────────────────────────────
async function atualizar(req, res) {
  try {
    // Separar campos do veículo (prefixo _), fornecedor e campos da ordem
    const body = req.body
    const fornecedor      = body.fornecedor
    const cnpj            = body.cnpj
    const placa           = body._placa       || body.placa
    const localidade      = body._localidade  || body.localidade
    const km_atual        = body._km_atual    !== undefined ? body._km_atual    : body.km_atual
    const proxima_revisao = body._proxima_revisao !== undefined ? body._proxima_revisao : body.proxima_revisao

    // Campos que vão para a tabela ordens (remover tudo que não é coluna de ordens)
    const camposOrdem = {}
    const colunasOrdem = ['supervisor','num_ordem','link_ordem','nota_fiscal','data_ordem','categoria','item','valor_item','quantidade','valor_total','status','origem']
    for (const col of colunasOrdem) {
      if (body[col] !== undefined) camposOrdem[col] = body[col]
    }

    if (camposOrdem.valor_item !== undefined || camposOrdem.quantidade !== undefined) {
      const vi = parseFloat(camposOrdem.valor_item) || 0
      const qt = parseInt(camposOrdem.quantidade)   || 1
      camposOrdem.valor_total = vi * qt
    }

    // Buscar a ordem para pegar veiculo_id e fornecedor_id
    const { data: ordemAtual } = await supabase
      .from('ordens').select('veiculo_id, fornecedor_id').eq('id', req.params.id).single()

    // Atualizar veículo
    if (ordemAtual?.veiculo_id) {
      const veiculoUpdate = { updated_at: new Date().toISOString() }
      if (placa)                        veiculoUpdate.placa = placa
      if (localidade)                   veiculoUpdate.localidade = localidade
      if (km_atual !== undefined)       veiculoUpdate.km_atual = km_atual
      if (proxima_revisao !== undefined) veiculoUpdate.proxima_revisao = proxima_revisao || null
      if (Object.keys(veiculoUpdate).length > 1) {
        await supabase.from('veiculos').update(veiculoUpdate).eq('id', ordemAtual.veiculo_id)
      }
    }

    // Atualizar fornecedor
    if (fornecedor && ordemAtual?.fornecedor_id) {
      await supabase.from('fornecedores')
        .update({ razao_social: fornecedor, updated_at: new Date().toISOString() })
        .eq('id', ordemAtual.fornecedor_id)
    }

    // Atualizar ordem
    const { data, error } = await supabase
      .from('ordens')
      .update({ ...camposOrdem, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Excluir ordem ────────────────────────────────────────────────────────────
async function excluir(req, res) {
  try {
    const { error } = await supabase
      .from('ordens')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Ordem excluída com sucesso' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// ── Atualizar só o status ────────────────────────────────────────────────────
async function atualizarStatus(req, res) {
  try {
    const { status } = req.body
    const statusValidos = ['Pendente', 'Em Preparação', 'Concluído', 'Cancelado']
    if (!statusValidos.includes(status))
      return res.status(400).json({ error: 'Status inválido' })

    const { data, error } = await supabase
      .from('ordens')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir, atualizarStatus }
