import * as XLSX from "xlsx"

export type DateValue =
  | { kind: "serial"; value: number; format?: string }
  | { kind: "text"; value: string }
  | { kind: "empty" }

export interface PatientRecord {
  id: string
  tanggal: DateValue
  nama: string
  alamat: string
  tindakan: string
  jenis: string
  fee: number
}

export interface SourceBlock {
  id: string
  name: string
  displayName: string
  sheetName: string
  periode: string
  records: PatientRecord[]
  reportedTotal: number | null
}

export interface RujukanDocument {
  fileName: string
  periodLabel: string
  sources: SourceBlock[]
  skippedSheets: string[]
  warnings: string[]
  loadedAt: number
  origin: "sample" | "upload" | "restored"
}

export const SAMPLE_FILE = "/RUJUKAN SEPTEMBER 2026 (RAW).xls"
export const STORAGE_KEY = "rujuk-rekapers:doc:v1"

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
]

type RawCell = { v: unknown; t?: string; z?: string }

let uidCounter = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`

const cellText = (cell: RawCell | undefined): string => {
  if (!cell || cell.v == null) return ""
  return String(cell.v)
}

const cellNumber = (cell: RawCell | undefined): number => {
  if (!cell || cell.v == null) return 0
  if (typeof cell.v === "number") return Number.isFinite(cell.v) ? cell.v : 0
  const parsed = Number(String(cell.v).replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const upper = (value: string) => value.trim().toUpperCase()

function sheetMatrix(ws: XLSX.WorkSheet | undefined): RawCell[][] {
  if (!ws?.["!ref"]) return []
  const range = XLSX.utils.decode_range(ws["!ref"])
  const rows: RawCell[][] = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: RawCell[] = []
    for (let c = 0; c <= Math.min(range.e.c, 7); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as RawCell | undefined
      row.push(cell ?? { v: null })
    }
    rows.push(row)
  }
  return rows
}

function toRecord(row: RawCell[]): PatientRecord {
  const dateCell = row[0]
  let tanggal: DateValue = { kind: "empty" }
  if (dateCell && typeof dateCell.v === "number" && Number.isFinite(dateCell.v)) {
    tanggal = { kind: "serial", value: dateCell.v, format: dateCell.z }
  } else if (dateCell && dateCell.v != null && String(dateCell.v).trim() !== "") {
    tanggal = { kind: "text", value: String(dateCell.v) }
  }
  return {
    id: uid("rec"),
    tanggal,
    nama: cellText(row[1]),
    alamat: cellText(row[2]),
    tindakan: cellText(row[3]),
    jenis: cellText(row[4]),
    fee: cellNumber(row[5])
  }
}

function parseSheet(ws: XLSX.WorkSheet | undefined, sheetName: string): SourceBlock[] {
  const rows = sheetMatrix(ws)
  const blocks: SourceBlock[] = []
  let i = 0
  while (i < rows.length) {
    if (upper(cellText(rows[i][0])) !== "DARI") {
      i++
      continue
    }
    const name = cellText(rows[i + 1]?.[1])
    const periode = cellText(rows[i + 1]?.[3])
    let header = i + 2
    while (
      header < rows.length &&
      upper(cellText(rows[header][0])) !== "TANGGAL" &&
      upper(cellText(rows[header][0])) !== "TOTAL"
    ) {
      header++
    }
    const records: PatientRecord[] = []
    let reportedTotal: number | null = null
    let cursor = header + 1
    if (header < rows.length && upper(cellText(rows[header][0])) === "TANGGAL") {
      for (; cursor < rows.length; cursor++) {
        const row = rows[cursor]
        const first = upper(cellText(row[0]))
        if (first === "TOTAL") {
          reportedTotal = cellNumber(row[5])
          break
        }
        if (first === "DARI") break
        const hasData = row.slice(0, 6).some((cell) => cell.v != null && String(cell.v).trim() !== "")
        if (hasData) records.push(toRecord(row))
      }
    }
    if (records.length > 0) {
      blocks.push({
        id: uid("src"),
        name,
        displayName: name.trim() || sheetName.trim(),
        sheetName,
        periode,
        records,
        reportedTotal
      })
    }
    i = cursor + 1
  }
  return blocks
}

export function serialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400000))
}

export function dateText(value: DateValue): string {
  if (value.kind === "serial") {
    const date = serialToDate(value.value)
    const dd = String(date.getUTCDate()).padStart(2, "0")
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
    return `${dd}/${mm}/${date.getUTCFullYear()}`
  }
  if (value.kind === "text") return value.value
  return ""
}

export function dateSortKey(value: DateValue): number {
  if (value.kind === "serial") return value.value
  if (value.kind === "text") {
    const match = value.value.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
    if (match) {
      const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
      return Date.UTC(year, Number(match[2]) - 1, Number(match[1])) / 86400000 + 25569
    }
  }
  return Number.NEGATIVE_INFINITY
}

export function parseRujukanWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
  origin: RujukanDocument["origin"]
): RujukanDocument {
  const sources: SourceBlock[] = []
  const skippedSheets: string[] = []
  const warnings: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const blocks = parseSheet(workbook.Sheets[sheetName], sheetName)
    if (blocks.length === 0) {
      skippedSheets.push(sheetName)
      continue
    }
    for (const block of blocks) {
      sources.push(block)
      const computed = sourceTotal(block)
      if (block.reportedTotal != null && block.reportedTotal !== computed) {
        warnings.push(
          `Total ${block.displayName} tertulis ${formatRupiah(block.reportedTotal)}, tetapi jumlah baris ${formatRupiah(computed)}.`
        )
      }
      if (block.name.trim() === "") {
        warnings.push(`Nama sumber pada sheet "${sheetName}" kosong; nama sheet dipakai sebagai label.`)
      }
    }
  }
  if (sources.length === 0) {
    throw new Error(
      "Tidak ditemukan blok rujukan (DARI / TANGGAL / TOTAL) pada file ini. Pastikan file RAW memiliki format seperti contoh."
    )
  }
  return {
    fileName,
    periodLabel: derivePeriod(fileName, sources),
    sources,
    skippedSheets,
    warnings,
    loadedAt: Date.now(),
    origin
  }
}

export function readRujukanFile(
  data: ArrayBuffer,
  fileName: string,
  origin: RujukanDocument["origin"]
): RujukanDocument {
  const workbook = XLSX.read(data, { type: "array", cellDates: false, cellNF: true, cellStyles: false })
  return parseRujukanWorkbook(workbook, fileName, origin)
}

function derivePeriod(fileName: string, sources: SourceBlock[]): string {
  const fromName = fileName.match(/([A-Za-z]+)\s+(\d{4})/)
  if (fromName) {
    const month = MONTHS_ID.find((m) => upper(m) === upper(fromName[1]))
    if (month) return `${month} ${fromName[2]}`
  }
  for (const source of sources) {
    for (const record of source.records) {
      if (record.tanggal.kind !== "empty") {
        const key = dateSortKey(record.tanggal)
        if (Number.isFinite(key)) {
          const date = serialToDate(key)
          return `${MONTHS_ID[date.getUTCMonth()]} ${date.getUTCFullYear()}`
        }
      }
    }
  }
  return "Periode tidak diketahui"
}

export const sourceTotal = (source: SourceBlock): number => source.records.reduce((sum, record) => sum + record.fee, 0)

export interface DocStats {
  patients: number
  sources: number
  totalFee: number
  bpjs: number
  umum: number
  withTindakan: number
  scCount: number
}

export function docStats(doc: RujukanDocument): DocStats {
  let patients = 0
  let totalFee = 0
  let bpjs = 0
  let umum = 0
  let withTindakan = 0
  let scCount = 0
  for (const source of doc.sources) {
    for (const record of source.records) {
      patients++
      totalFee += record.fee
      const jenis = upper(record.jenis)
      if (jenis === "BPJS") bpjs++
      else if (jenis === "UMUM") umum++
      if (record.tindakan.trim() !== "") withTindakan++
      if (upper(record.tindakan).startsWith("SC")) scCount++
    }
  }
  return { patients, sources: doc.sources.length, totalFee, bpjs, umum, withTindakan, scCount }
}

export const jenisLabel = (record: PatientRecord): string => upper(record.jenis) || "LAINNYA"

export function uniqueTindakan(doc: RujukanDocument): string[] {
  const set = new Set<string>()
  for (const source of doc.sources) {
    for (const record of source.records) {
      const value = record.tindakan.trim()
      if (value !== "") set.add(value)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "id"))
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
})
const numberFormatter = new Intl.NumberFormat("id-ID")

export const formatRupiah = (value: number): string => rupiahFormatter.format(value)
export const formatNumber = (value: number): string => numberFormatter.format(value)

export function outputFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "")
  if (/\(RAW\)/i.test(base)) return `${base.replace(/\(RAW\)/i, "(FINAL)")}.xlsx`
  return `${base} (FINAL).xlsx`
}

export function emptyRecord(): PatientRecord {
  return {
    id: uid("rec"),
    tanggal: { kind: "empty" },
    nama: "",
    alamat: "",
    tindakan: "",
    jenis: "BPJS",
    fee: 0
  }
}

export function parseDateInput(value: string): DateValue {
  const trimmed = value.trim()
  if (trimmed === "") return { kind: "empty" }
  return { kind: "text", value: trimmed }
}
