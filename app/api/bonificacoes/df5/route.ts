import { NextRequest, NextResponse } from "next/server"
import { getCalculoResult } from "@/lib/calculo-cache"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const execId = searchParams.get("exec_id")
    const format = searchParams.get("format") || "json"

    if (!execId) {
      return NextResponse.json(
        { error: "Parâmetro exec_id é obrigatório" },
        { status: 400 }
      )
    }

    const cacheEntry = getCalculoResult(execId)
    if (!cacheEntry) {
      return NextResponse.json(
        { error: "Execução não encontrada. Tente novamente mais tarde." },
        { status: 404 }
      )
    }

    const { df5 } = cacheEntry
    if (!df5 || !Array.isArray(df5) || df5.length === 0) {
      return NextResponse.json(
        { error: "Nenhum dado disponível para df5" },
        { status: 404 }
      )
    }

    if (format === "json") {
      return NextResponse.json({ execId, rows: df5 })
    }

    const worksheet = XLSX.utils.json_to_sheet(df5)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "df5")

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=df5_${execId}.xlsx`,
      },
    })
  } catch (error) {
    console.error("[DF5 Route] Error exporting df5:", error)
    return NextResponse.json(
      { error: "Erro ao gerar o arquivo" },
      { status: 500 }
    )
  }
}


