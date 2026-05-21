// ============================================================
// FREIGHT-MS — Rota de diagnóstico (REMOVER após usar)
// src/app/api/omie/debug/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createOmieClient } from '@/lib/omie/client'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const client = createOmieClient()

    // Buscar apenas a página 1 com 3 fornecedores
    const data = await client.listarFornecedores(1, 3)

    return NextResponse.json({
      total_paginas: data.total_paginas,
      quantidade_retornada: data.fornecedores?.length ?? 0,
      // Mostrar os campos brutos do primeiro fornecedor
      primeiro_fornecedor_raw: data.fornecedores?.[0] ?? null,
      // Listar os campos que existem
      campos_disponiveis: data.fornecedores?.[0] ? Object.keys(data.fornecedores[0]) : [],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
