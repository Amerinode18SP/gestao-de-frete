import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fmtBrl(v: number | null | undefined): string {
  if (v == null) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export async function GET(req: NextRequest) {
  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  const dataInicio = req.nextUrl.searchParams.get('data_inicio')
  const dataFim    = req.nextUrl.searchParams.get('data_fim')

  if (!empresa_id) return NextResponse.json({ error: 'empresa_id obrigatorio' }, { status: 400 })

  const supabase = createSupabaseAdmin()

  let query = supabase
    .from('ctes')
    .select(`
      numero_cte, data_emissao, status,
      valor_servico, modal, peso_real,
      uf_origem, uf_destino,
      destinatario_nome, remetente_nome,
      centro_custo_nome,
      fornecedor:fornecedores(nome)
    `)
    .eq('empresa_id', empresa_id)
    .order('data_emissao', { ascending: false })

  if (dataInicio) query = query.gte('data_emissao', dataInicio)
  if (dataFim)    query = query.lte('data_emissao', dataFim)

  const { data, error } = await query.limit(100000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ctes = data ?? []

  // Gerar XML do Excel (SpreadsheetML)
  const rows = ctes.map((c: any) => {
    const transportadora = (c.fornecedor as any)?.nome || c.remetente_nome || ''
    const rota = c.uf_origem && c.uf_destino ? `${c.uf_origem} → ${c.uf_destino}` : ''
    return `    <Row>
      <Cell><Data ss:Type="String">${escapeXml(c.numero_cte)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(fmtDate(c.data_emissao))}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(transportadora)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(c.destinatario_nome)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(rota)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(c.modal)}</Data></Cell>
      <Cell><Data ss:Type="Number">${c.peso_real ?? 0}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(c.centro_custo_nome)}</Data></Cell>
      <Cell><Data ss:Type="Number">${c.valor_servico ?? 0}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(c.status)}</Data></Cell>
    </Row>`
  }).join('\n')

  const header = `    <Row>
      <Cell ss:StyleID="header"><Data ss:Type="String">Nº CT-e</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Emissão</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Transportadora</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Destinatário</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Rota</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Modal</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Peso (kg)</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Centro de Custo</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Valor (R$)</Data></Cell>
      <Cell ss:StyleID="header"><Data ss:Type="String">Status</Data></Cell>
    </Row>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1A1916" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="CT-es">
    <Table>
${header}
${rows}
    </Table>
  </Worksheet>
</Workbook>`

  const periodo = dataInicio && dataFim
    ? `${dataInicio}_a_${dataFim}`
    : new Date().toISOString().split('T')[0]

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="ctes_${periodo}.xls"`,
    },
  })
}
