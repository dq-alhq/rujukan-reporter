import JSZip from "jszip"
import { dateText, formatRupiah, jenisLabel, type SourceBlock, sourceTotal } from "./rujukan"

const WIDTHS = [150, 270, 180, 250, 100, 150]
const TOTAL_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0)
const escapeXml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
      })[character] ?? character
  )

const truncate = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

const text = (value: string, x: number, y: number, options: { anchor?: string; fill?: string; bold?: boolean } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${options.anchor ?? "start"}" fill="${options.fill ?? "black"}" font-family="Arial, sans-serif" font-size="14" font-weight="${options.bold ? 700 : 400}">${escapeXml(value)}</text>`

function rowCells(source: SourceBlock): string {
  return source.records
    .map((record, index) => {
      const y = 76 + index * 34
      const values = [
        truncate(dateText(record.tanggal), 18),
        truncate(record.nama, 36),
        truncate(record.alamat, 26),
        truncate(record.tindakan, 32)
      ]
      let x = 0
      const cells = WIDTHS.map((width) => {
        const cell = `<rect x="${x}" y="${y}" width="${width}" height="34" fill="white" stroke="black" stroke-width="1"/>`
        x += width
        return cell
      }).join("")
      const badgeX = WIDTHS[0] + WIDTHS[1] + WIDTHS[2] + WIDTHS[3] + 20
      return [
        cells,
        text(values[0], 12, y + 22),
        text(values[1], WIDTHS[0] + 12, y + 22),
        text(values[2], WIDTHS[0] + WIDTHS[1] + 12, y + 22),
        text(values[3], WIDTHS[0] + WIDTHS[1] + WIDTHS[2] + 12, y + 22),
        `<rect x="${badgeX}" y="${y + 8}" width="58" height="20" rx="10" fill="white" stroke="blue" stroke-width="1" />`,
        text(jenisLabel(record), badgeX + 29, y + 22, { anchor: "middle", fill: "blue" }),
        text(formatRupiah(record.fee), TOTAL_WIDTH - 12, y + 22, { anchor: "end" })
      ].join("")
    })
    .join("")
}

function buildSvg(source: SourceBlock): string {
  const dataHeight = source.records.length * 34
  const totalY = 76 + dataHeight
  const height = totalY + 36
  const headerLabels = ["TANGGAL", "NAMA PASIEN", "ALAMAT", "TINDAKAN", "BPJS/UMUM", "FEE"]
  let x = 0
  const header = WIDTHS.map((width, index) => {
    const cell = [
      `<rect x="${x}" y="36" width="${width}" height="40" fill="green"/>`,
      text(headerLabels[index], x + width / 2, 61, { anchor: "middle", fill: "white", bold: true })
    ].join("")
    x += width
    return cell
  }).join("")

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_WIDTH}" height="${height}" viewBox="0 0 ${TOTAL_WIDTH} ${height}">`,
    `<rect width="${TOTAL_WIDTH}" height="${height}" fill="white"/>`,
    `<rect x="0" y="0" width="${TOTAL_WIDTH}" height="36" fill="blue"/>`,
    `<rect x="0" y="22" width="${TOTAL_WIDTH}" height="14" fill="blue"/>`,
    text(source.displayName, TOTAL_WIDTH / 2, 24, { anchor: "middle", fill: "white", bold: true }),
    header,
    rowCells(source),
    `<rect x="0" y="${totalY}" width="${TOTAL_WIDTH}" height="36" rx="0" fill="green"/>`,
    `<rect x="0" y="${totalY + 22}" width="${TOTAL_WIDTH}" height="14" fill="green"/>`,
    text("TOTAL", TOTAL_WIDTH / 2, totalY + 23, { anchor: "middle", fill: "white", bold: true }),
    text(formatRupiah(sourceTotal(source)), TOTAL_WIDTH - 12, totalY + 23, {
      anchor: "end",
      fill: "white",
      bold: true
    }),
    "</svg>"
  ].join("")
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function renderRincianImage(source: SourceBlock): Promise<Blob> {
  const svgBlob = new Blob([buildSvg(source)], { type: "image/svg+xml;charset=utf-8" })
  const image = new Image()
  const imageUrl = URL.createObjectURL(svgBlob)
  image.src = imageUrl

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("Gagal merender gambar tabel."))
    })
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Browser tidak mendukung pembuatan gambar.")
    context.drawImage(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat file PNG."))), "image/png")
    })
    return png
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

const imageFileName = (source: SourceBlock, index?: number): string => {
  const prefix = index == null ? "" : `${String(index + 1).padStart(2, "0")} - `
  return `${prefix}${source.displayName.replace(/[\\/:*?"<>|]+/g, "_")} - Rincian.png`
}

export async function downloadRincianImage(source: SourceBlock): Promise<void> {
  const png = await renderRincianImage(source)
  downloadBlob(png, imageFileName(source))
}

export async function downloadAllRincianImages(sources: SourceBlock[]): Promise<void> {
  const zip = new JSZip()
  for (const [index, source] of sources.entries()) {
    const png = await renderRincianImage(source)
    zip.file(imageFileName(source, index), png)
  }
  const archive = await zip.generateAsync({ type: "blob" })
  downloadBlob(archive, "Rincian - Semua Gambar.zip")
}
