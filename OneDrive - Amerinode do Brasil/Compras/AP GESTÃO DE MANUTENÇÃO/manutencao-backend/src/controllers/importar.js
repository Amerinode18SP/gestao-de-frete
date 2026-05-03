const XLSX     = require('xlsx')
const supabase = require('../supabase')

// Normaliza nomes de colunas: remove acentos, espaços → underscore, lowercase
function normalizarChave(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/\s+/g, '_')
}

// Converte data em qualquer formato → YYYY-MM-DD
function parseData(valor) {
  if (!valor) return null
  const s = String(valor).trim()
  if (!s) return null
  // YYYY-MM-DD (já correto)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // YYYY-MM-DD HH:mm:ss (Excel datetime)
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) return s.split(' ')[0]
  // YYYY-MM-DDTHH:mm (ISO)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split('T')[0]
  // DD/MM/YYYY
  const partes = s.split('/')
  if (partes.length === 3) {
    const [d, m, a] = partes
    if (a && a.length === 4) return `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // MM/DD/YYYY (formato americano)
  const partesUS = s.split('/')
  if (partesUS.length === 3 && partesUS[2].length === 4) {
    const [m, d, a] = partesUS
    return `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return null
}

function parseMoeda(valor) {
  if (!valor && valor !== 0) return 0
  return parseFloat(String(valor).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
}

async function importar(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' })

    const wb   = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

    if (!rows.length) return res.status(400).json({ error: 'Arquivo vazio ou sem dados.' })

    // Normaliza chaves de todas as linhas
    const normalizado = rows.map(row => {
      const obj = {}
      for (const k of Object.keys(row)) obj[normalizarChave(k)] = row[k]
      return obj
    })

    const erros    = []
    const inseridos = []

    for (let i = 0; i < normalizado.length; i++) {
      const r   = normalizado[i]
      const lin = i + 2 // linha real no Excel (cabeçalho = 1)

      // Campos obrigatórios
      const obrigatorios = ['placa','localidade','supervisor','nota_fiscal','categoria','item','fornecedor','cnpj']
      const faltando = obrigatorios.filter(c => !r[c])
      if (faltando.length) {
        erros.push({ linha: lin, erro: `Campos obrigatórios faltando: ${faltando.join(', ')}` })
        continue
      }

      // Categoria válida
      if (!['Serviço','Servico','Produto'].includes(r.categoria)) {
        erros.push({ linha: lin, erro: `Categoria inválida: "${r.categoria}". Use "Serviço" ou "Produto"` })
        continue
      }

      try {
        // Upsert veículo
        const { data: v, error: ve } = await supabase
          .from('veiculos')
          .upsert({
            placa:            r.placa.toString().toUpperCase().trim(),
            localidade:       r.localidade.toString().trim(),
            km_atual:         r.km_atual ? parseInt(r.km_atual) : null,
            proxima_revisao:  parseData(r.proxima_revisao)
          }, { onConflict: 'placa' })
          .select().single()
        if (ve) throw ve

        // Upsert fornecedor
        const cnpjLimpo = r.cnpj.toString().replace(/\D/g, '')
        const { data: f, error: fe } = await supabase
          .from('fornecedores')
          .upsert({ razao_social: r.fornecedor.toString().trim(), cnpj: cnpjLimpo },
                   { onConflict: 'cnpj' })
          .select().single()
        if (fe) throw fe

        // Inserir ordem
        const vi = parseMoeda(r.valor_item)
        const qt = parseInt(r.quantidade) || 1

        const { data: o, error: oe } = await supabase
          .from('ordens')
          .insert({
            veiculo_id:    v.id,
            fornecedor_id: f.id,
            supervisor:    r.supervisor.toString().trim(),
            num_ordem:     r.num_ordem  ? r.num_ordem.toString().trim()  : null,
            link_ordem:    r.link_ordem ? r.link_ordem.toString().trim() : null,
            nota_fiscal:   r.nota_fiscal.toString().trim(),
            data_ordem:    parseData(r.data_ordem) || new Date().toISOString().split('T')[0],
            categoria:     r.categoria === 'Servico' ? 'Serviço' : r.categoria,
            item:          r.item.toString().trim(),
            valor_item:    vi,
            quantidade:    qt,
            valor_total:   vi * qt,
            status:        'Pendente',
            origem:        'Excel'
          })
          .select().single()
        if (oe) throw oe

        inseridos.push(o)
      } catch (err) {
        erros.push({ linha: lin, erro: err.message })
      }
    }

    res.json({
      total_linhas:   normalizado.length,
      importados:     inseridos.length,
      erros_count:    erros.length,
      erros,
      data:           inseridos
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { importar }
