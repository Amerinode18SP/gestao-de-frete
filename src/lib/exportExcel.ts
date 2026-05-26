import * as XLSX from 'xlsx'

interface StateData { name: string; uf: string; ctes: number; value: number; modal: string }
interface ChartItem { label: string; value: number }
interface Summary {
  totalValue: number; totalCtes: number; stateCount: number
  ticketMedio: number; topState: StateData | null
}
interface MapData {
  summary: Summary; byState: StateData[]; byModal: ChartItem[]; byCC: ChartItem[]
}

// Aplica formato de célula numa planilha inteira por coluna
function applyColFormat(ws: XLSX.WorkSheet, col: number, fmt: string, startRow: number, endRow: number) {
  for (let r = startRow; r <= endRow; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: col })
    if (ws[addr]) ws[addr].z = fmt
  }
}

export function exportarMapeamentoExcel(data: MapData) {
  const s = data.summary
  const wb = XLSX.utils.book_new()

  // ── ABA 1: Resumo ──────────────────────────────────────────────────────
  const wsResumo = XLSX.utils.aoa_to_sheet([
    ['Mapeamento de Remessas — Gestão de Log'],
    ['Gerado em:', new Date().toLocaleString('pt-BR')],
    [],
    ['INDICADOR', 'VALOR'],
    ['Valor Total Remessas', s.totalValue],
    ['Total de CT-es', s.totalCtes],
    ['Estados com Remessas', s.stateCount],
    ['Ticket Médio / CT-e', s.ticketMedio],
    ['Estado de Maior Gasto', s.topState?.name ?? '—'],
    ['Valor Maior Estado', s.topState?.value ?? 0],
  ])
  // Formata valores monetários nas linhas certas (índice 0-based: linha 4, 7, 9)
  ;[4, 7, 9].forEach(r => {
    const addr = XLSX.utils.encode_cell({ r, c: 1 })
    if (wsResumo[addr]) wsResumo[addr].z = '#,##0.00'
  })
  wsResumo['!cols'] = [{ wch: 26 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── ABA 2: Por Estado ──────────────────────────────────────────────────
  const stateRows = (data.byState ?? []).map((d, i) => {
    const pct  = s.totalValue > 0 ? d.value / s.totalValue : 0
    const tick = d.ctes > 0 ? d.value / d.ctes : 0
    return [i + 1, d.name, d.uf, d.ctes, d.modal, d.value, tick, pct]
  })
  const wsEstado = XLSX.utils.aoa_to_sheet([
    ['#', 'Estado', 'UF', 'CT-es', 'Modal Predominante', 'Valor Total (R$)', 'Ticket Médio (R$)', 'Participação %'],
    ...stateRows,
  ])
  // col 5 = Valor Total, col 6 = Ticket Médio, col 7 = Participação %
  applyColFormat(wsEstado, 5, '#,##0.00', 1, stateRows.length)
  applyColFormat(wsEstado, 6, '#,##0.00', 1, stateRows.length)
  applyColFormat(wsEstado, 7, '0.00%',    1, stateRows.length)
  wsEstado['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 5 }, { wch: 7 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 13 },
  ]
  XLSX.utils.book_append_sheet(wb, wsEstado, 'Por Estado')

  // ── ABA 3: Por Modal ───────────────────────────────────────────────────
  const modalRows = (data.byModal ?? []).map(m => [
    m.label, m.value, s.totalValue > 0 ? m.value / s.totalValue : 0,
  ])
  const wsModal = XLSX.utils.aoa_to_sheet([
    ['Modal', 'Valor Total (R$)', 'Participação %'],
    ...modalRows,
  ])
  applyColFormat(wsModal, 1, '#,##0.00', 1, modalRows.length)
  applyColFormat(wsModal, 2, '0.00%',    1, modalRows.length)
  wsModal['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, wsModal, 'Por Modal')

  // ── ABA 4: Por Centro de Custo ─────────────────────────────────────────
  const ccRows = (data.byCC ?? []).map(c => [
    c.label, c.value, s.totalValue > 0 ? c.value / s.totalValue : 0,
  ])
  const wsCC = XLSX.utils.aoa_to_sheet([
    ['Centro de Custo', 'Valor Total (R$)', 'Participação %'],
    ...ccRows,
  ])
  applyColFormat(wsCC, 1, '#,##0.00', 1, ccRows.length)
  applyColFormat(wsCC, 2, '0.00%',    1, ccRows.length)
  wsCC['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, wsCC, 'Por Centro de Custo')

  // Gera e baixa
  XLSX.writeFile(wb, 'mapeamento-remessas-' + new Date().toISOString().slice(0, 10) + '.xlsx')
}
