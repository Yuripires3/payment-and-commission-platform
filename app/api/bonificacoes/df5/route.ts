import { NextRequest, NextResponse } from "next/server"
import { getCalculoResult } from "@/lib/calculo-cache"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const execId = searchParams.get("exec_id") || ""
    const format = (searchParams.get("format") || "xlsx").toLowerCase()

    console.log(`[DF5 Route] Request received - exec_id: ${execId}, format: ${format}`)

    if (!execId) {
      console.log("[DF5 Route] Missing exec_id parameter")
      return NextResponse.json({ error: "Parâmetro exec_id é obrigatório" }, { status: 400 })
    }

    const data = getCalculoResult(execId)
    if (!data) {
      console.log(`[DF5 Route] exec_id not found in cache: ${execId}`)
      return NextResponse.json({ 
        error: "exec_id não encontrado ou expirado",
        exec_id: execId,
        hint: "Certifique-se de que o cálculo foi concluído e o exec_id é válido"
      }, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      })
    }

    const df5 = data.df5 || []
    if (!Array.isArray(df5) || df5.length === 0) {
      console.log(`[DF5 Route] df5 is empty for exec_id: ${execId}`)
      return NextResponse.json({ 
        error: "df5 vazio para este exec_id",
        exec_id: execId,
        hint: "O cálculo pode não ter gerado dados df5"
      }, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      })
    }

    console.log(`[DF5 Route] Generating ${format} file with ${df5.length} rows for exec_id: ${execId}`)

    if (format === "csv") {
      // CSV
      const ws = XLSX.utils.json_to_sheet(df5)
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", RS: "\n" })
      const fileName = `df5_${execId}.csv`
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=${fileName}`,
        },
      })
    }

    // XLSX (padrão)
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(df5)
    XLSX.utils.book_append_sheet(wb, ws, "df5")
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const fileName = `df5_${execId}.xlsx`
    return new NextResponse(Buffer.from(out), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${fileName}`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao gerar df5" }, { status: 500 })
  }
}


