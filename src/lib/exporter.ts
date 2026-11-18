import ExcelJS from "exceljs"
import { type PatientRecord, type RujukanDocument, type SourceBlock, sourceTotal } from "./rujukan"

const RUPIAH_FMT = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" -'
const FEE_FMT = "#,##0"
const DEFAULT_DATE_FMT = "dd/mm/yyyy"

const COLORS = {
  border: "000000",
  header: "FFFFF2CC",
  section: "FFEAF2F8",
  total: "FFE2F0D9",
  text: "000000",
  muted: "FF5B6573"
} as const

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } }
}

const fill = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb }
})

const labelOf = (source: SourceBlock): string => (source.name.trim() !== "" ? source.name : source.sheetName.trim())

function setBlockStyle(sheet: ExcelJS.Worksheet, startRow: number, source: SourceBlock): void {
  const titleRow = sheet.getRow(startRow)
  const headerRow = sheet.getRow(startRow + 1)
  const dataStart = startRow + 2
  const totalRow = dataStart + source.records.length

  sheet.mergeCells(startRow + 1, 2, startRow + 1, 3)
  sheet.mergeCells(startRow, 2, startRow, 3)
  sheet.mergeCells(totalRow, 1, totalRow, 5)

  for (const rowNumber of [startRow, startRow + 1]) {
    const row = sheet.getRow(rowNumber)
    for (let column = 1; column <= 6; column++) {
      const cell = row.getCell(column)
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
      cell.border = thinBorder
    }
  }

  for (let column = 1; column <= 6; column++) {
    const cell = titleRow.getCell(column)
    cell.fill = fill(COLORS.total)
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = thinBorder
  }

  for (let column = 1; column <= 6; column++) {
    const cell = headerRow.getCell(column)
    cell.fill = fill(COLORS.header)
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    cell.border = thinBorder
  }

  for (let rowNumber = dataStart; rowNumber < totalRow; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    for (let column = 1; column <= 6; column++) {
      const cell = row.getCell(column)
      cell.font = { name: "Arial", size: 10, color: { argb: COLORS.text } }
      cell.alignment = {
        vertical: "middle",
        horizontal: column === 6 ? "right" : column === 5 || column === 1 ? "center" : "left",
        wrapText: column === 2 || column === 3 || column === 4
      }
      cell.border = thinBorder
    }
    row.getCell(1).numFmt = DEFAULT_DATE_FMT
    row.getCell(6).numFmt = FEE_FMT
  }

  const total = sheet.getRow(totalRow)
  for (let column = 1; column <= 6; column++) {
    const cell = total.getCell(column)
    cell.fill = fill(COLORS.total)
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
    cell.alignment = { vertical: "middle", horizontal: column === 6 ? "right" : "center" }
    cell.border = thinBorder
  }
  total.getCell(6).numFmt = FEE_FMT
}

function addRecordRow(sheet: ExcelJS.Worksheet, rowNumber: number, record: PatientRecord): void {
  const row = sheet.getRow(rowNumber)
  row.values = [
    record.tanggal.kind === "serial"
      ? record.tanggal.value
      : record.tanggal.kind === "text"
        ? record.tanggal.value
        : null,
    record.nama,
    record.alamat,
    record.tindakan,
    record.jenis,
    record.fee
  ]
}

export function buildFinalWorkbook(doc: RujukanDocument): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Rujuk Rekap"
  workbook.created = new Date()

  const rincian = workbook.addWorksheet("RINCIAN", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  })
  rincian.columns = [
    { key: "tanggal", width: 14 },
    { key: "nama", width: 24 },
    { key: "alamat", width: 28 },
    { key: "tindakan", width: 22 },
    { key: "jenis", width: 14 },
    { key: "fee", width: 16 }
  ]

  let rowNumber = 1
  doc.sources.forEach((source, index) => {
    rincian.getRow(rowNumber).values = ["DARI", labelOf(source), null, "PERIODE", null, null]
    rincian.getRow(rowNumber + 1).values = ["TANGGAL", "NAMA PASIEN", "ALAMAT", "TINDAKAN", "UMUM/BPJS", "FEE"]
    source.records.map((record, recordIndex) => addRecordRow(rincian, rowNumber + 2 + recordIndex, record))
    rincian.getRow(rowNumber + 2 + source.records.length).values = [
      "TOTAL",
      null,
      null,
      null,
      null,
      sourceTotal(source)
    ]
    setBlockStyle(rincian, rowNumber, source)
    rowNumber += source.records.length + 4
    if (index < doc.sources.length - 1) {
      rincian.getRow(rowNumber).height = 8
      rowNumber++
    }
  })

  const rekap = workbook.addWorksheet("REKAP", {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  })
  rekap.columns = [
    { key: "no", width: 6 },
    { key: "nama", width: 38 },
    { key: "total", width: 18 }
  ]
  rekap.views = [{ state: "frozen", ySplit: 1 }]
  rekap.getRow(1).values = ["NO", "NAMA", "TOTAL"]
  for (let column = 1; column <= 3; column++) {
    const cell = rekap.getCell(1, column)
    cell.fill = fill(COLORS.header)
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
    cell.alignment = { vertical: "middle", horizontal: "center" }
    cell.border = thinBorder
  }

  doc.sources.forEach((source, index) => {
    const row = rekap.getRow(index + 2)
    row.values = [index + 1, labelOf(source), sourceTotal(source)]
    for (let column = 1; column <= 3; column++) {
      const cell = row.getCell(column)
      cell.font = { name: "Arial", size: 10, color: { argb: COLORS.text } }
      cell.alignment = { vertical: "middle", horizontal: column === 3 ? "right" : column === 1 ? "center" : "left" }
      cell.border = thinBorder
    }
    row.getCell(3).numFmt = RUPIAH_FMT
  })

  const totalRowNumber = doc.sources.length + 2
  const totalRow = rekap.getRow(totalRowNumber)
  totalRow.values = ["TOTAL", null, doc.sources.reduce((sum, source) => sum + sourceTotal(source), 0)]
  for (let column = 1; column <= 3; column++) {
    const cell = totalRow.getCell(column)
    cell.fill = fill(COLORS.total)
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: COLORS.text } }
    cell.alignment = { vertical: "middle", horizontal: column === 3 ? "right" : "center" }
    cell.border = thinBorder
  }
  totalRow.getCell(3).numFmt = RUPIAH_FMT
  rekap.mergeCells(totalRowNumber, 1, totalRowNumber, 2)

  return workbook
}

export async function downloadFinal(doc: RujukanDocument, fileName: string): Promise<void> {
  const workbook = buildFinalWorkbook(doc)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
