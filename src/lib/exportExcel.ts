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

export function exportarMapeamentoExcel(data: MapData) {
  const s = data.summary
  const wb = XLSX.utils.book_new()

  // ── ABA 1: Resumo ──────────────────────────────────────
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
  wsResumo['!cols'] = [{ wch: 26 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── ABA 2: Por Estado ──────────────────────────────────
  const wsEstado = XLSX.utils.aoa_to_sheet([
    ['#', 'Estado', 'UF', 'CT-es', 'Modal Predominante', 'Valor Total (R$)', 'Ticket Médio (R$)', 'Participação %'],
    ...(data.byState ?? []).map((d, i) => {
      const pct  = s.totalValue > 0 ? d.value / s.totalValue : 0
      const tick = d.ctes > 0 ? d.value / d.ctes : 0
      return [i + 1, d.name, d.uf, d.ctes, d.modal, d.value, tick, pct]
    }),
  ])
  wsEstado['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 5 }, { wch: 7 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 13 },
  ]
  XLSX.utils.book_append_sheet(wb, wsEstado, 'Por Estado')

  // ── ABA 3: Por Modal ───────────────────────────────────
  const wsModal = XLSX.utils.aoa_to_sheet([
    ['Modal', 'Valor Total (R$)', 'Participação %'],
    ...(data.byModal ?? []).map(m => [
      m.label, m.value, s.totalValue > 0 ? m.value / s.totalValue : 0,
    ]),
  ])
  wsModal['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, wsModal, 'Por Modal')

  // ── ABA 4: Por Centro de Custo ─────────────────────────
  const wsCC = XLSX.utils.aoa_to_sheet([
    ['Centro de Custo', 'Valor Total (R$)', 'Participação %'],
    ...(data.byCC ?? []).map(c => [
      c.label, c.value, s.totalValue > 0 ? c.value / s.totalValue : 0,
    ]),
  ])
  wsCC['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 13 }]
  XLSX.utils.book_append_sheet(wb, wsCC, 'Por Centro de Custo')

  // Gera e baixa
  XLSX.writeFile(wb, 'mapeamento-remessas-' + new Date().toISOString().slice(0, 10) + '.xlsx')
}
