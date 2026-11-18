import { IconFileExcel, IconFileSpreadsheet, IconPhotoDown, IconRefresh, IconUpload } from "@tabler/icons-react"
import { type ChangeEvent, type DragEvent, useCallback, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { downloadFinal } from "@/lib/exporter"
import { downloadAllRincianImages, downloadRincianImage } from "@/lib/image-exporter"
import {
  dateText,
  docStats,
  formatNumber,
  formatRupiah,
  jenisLabel,
  outputFileName,
  type PatientRecord,
  type RujukanDocument,
  readRujukanFile,
  type SourceBlock,
  sourceTotal
} from "@/lib/rujukan"
import { Badge } from "./components/ui/badge"
import { Drawer } from "./components/ui/drawer"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Table } from "./components/ui/table"
import { Tabs } from "./components/ui/tabs"

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-muted-foreground text-xs tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-muted-foreground text-xs">{hint}</div> : null}
    </div>
  )
}

function RincianView({
  doc,
  onDownloadImage
}: {
  doc: RujukanDocument
  onDownloadImage: (source: SourceBlock) => void
}) {
  return (
    <div className="w-full space-y-6">
      {doc.sources.map((source) => (
        <div className="overflow-hidden rounded-xl border" key={source.id}>
          <Button
            className="text-primary-foreground relative flex w-full items-center justify-center rounded-none border-0 bg-emerald-600 px-4 py-2 text-lg font-bold"
            onClick={() => onDownloadImage(source)}
          >
            {source.displayName}
          </Button>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <Table.Header className="bg-emerald-800 text-center text-xs uppercase">
                <Table.Row className="*:text-primary-foreground *:text-center">
                  <Table.Head>Tanggal</Table.Head>
                  <Table.Head>Nama Pasien</Table.Head>
                  <Table.Head>Alamat</Table.Head>
                  <Table.Head>Tindakan</Table.Head>
                  <Table.Head>BPJS/UMUM</Table.Head>
                  <Table.Head>Fee</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {source.records.map((record: PatientRecord) => (
                  <Table.Row key={record.id}>
                    <Table.Cell className="text-center whitespace-nowrap tabular-nums">
                      {dateText(record.tanggal)}
                    </Table.Cell>
                    <Table.Cell>{record.nama}</Table.Cell>
                    <Table.Cell>{record.alamat}</Table.Cell>
                    <Table.Cell>{record.tindakan}</Table.Cell>
                    <Table.Cell className="text-center">
                      <Badge variant={jenisLabel(record) === "BPJS" ? "default" : "destructive"}>
                        {jenisLabel(record)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{formatRupiah(record.fee)}</Table.Cell>
                  </Table.Row>
                ))}
                <Table.Row className="text-primary-foreground bg-emerald-700 font-medium">
                  <Table.Cell className="text-center" colSpan={5}>
                    TOTAL
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">{formatRupiah(sourceTotal(source))}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}

function RekapView({ doc }: { doc: RujukanDocument }) {
  const grand = useMemo(() => doc.sources.reduce((sum, s) => sum + sourceTotal(s), 0), [doc])
  return (
    <div className="w-full overflow-hidden rounded-xl border">
      <Table className="w-full">
        <Table.Header className="bg-emerald-800 text-center text-xs uppercase">
          <Table.Row className="*:text-primary-foreground *:text-center">
            <Table.Head>No</Table.Head>
            <Table.Head>Nama</Table.Head>
            <Table.Head>Total</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {doc.sources.map((source: SourceBlock, i: number) => (
            <Drawer key={source.id} swipeDirection="right">
              <Drawer.Trigger
                render={
                  <Table.Row className="cursor-pointer" key={source.id}>
                    <Table.Cell className="text-center">{i + 1}</Table.Cell>
                    <Table.Cell>{source.displayName}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{formatRupiah(sourceTotal(source))}</Table.Cell>
                  </Table.Row>
                }
              />
              <Drawer.Content className="w-full max-w-4xl">
                <Drawer.Header>
                  <Drawer.Title>Rincian {source.displayName}</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body>
                  <RincianView
                    doc={Object.assign({}, doc, { sources: [source] })}
                    onDownloadImage={() => void downloadRincianImage(source)}
                  />
                </Drawer.Body>
                <Drawer.Footer>
                  <Button className="w-full" onClick={() => void downloadRincianImage(source)}>
                    <IconPhotoDown /> Unduh Gambar
                  </Button>
                </Drawer.Footer>
              </Drawer.Content>
            </Drawer>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row className="*:text-primary-foreground bg-emerald-700">
            <Table.Cell className="text-center" colSpan={2}>
              TOTAL
            </Table.Cell>
            <Table.Cell className="text-right tabular-nums">{formatRupiah(grand)}</Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </div>
  )
}

export function App() {
  const [doc, setDoc] = useState<RujukanDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = readRujukanFile(buffer, file.name, "upload")
      setDoc(parsed)
    } catch (err) {
      setDoc(null)
      setError(err instanceof Error ? err.message : "Gagal membaca file.")
    } finally {
      setBusy(false)
    }
  }, [])

  const onPick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) void handleFile(file)
      event.target.value = ""
    },
    [handleFile]
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault()
      const file = event.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile]
  )

  const stats = doc ? docStats(doc) : null

  const download = useCallback(async () => {
    if (!doc) return
    setBusy(true)
    setError(null)
    try {
      await downloadFinal(doc, outputFileName(doc.fileName))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat file FINAL.")
    } finally {
      setBusy(false)
    }
  }, [doc])

  const downloadImage = useCallback(async (source: SourceBlock) => {
    setBusy(true)
    setError(null)
    try {
      await downloadRincianImage(source)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat gambar tabel.")
    } finally {
      setBusy(false)
    }
  }, [])

  const downloadAllImages = useCallback(async () => {
    if (!doc) return
    setBusy(true)
    setError(null)
    try {
      await downloadAllRincianImages(doc.sources)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat semua gambar tabel.")
    } finally {
      setBusy(false)
    }
  }, [doc])

  const reset = useCallback(() => {
    setDoc(null)
    setError(null)
  }, [])

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading flex w-full justify-center text-2xl font-semibold sm:justify-start">
          RUJUKAN REPORTER
        </h1>
        <div className="grid w-full gap-2 sm:grid-cols-3">
          {doc ? (
            <Button onClick={reset} variant="outline">
              <IconRefresh /> Ganti file
            </Button>
          ) : null}
          <Button disabled={!doc || busy} onClick={() => void downloadAllImages()} variant="outline">
            <IconPhotoDown /> {busy ? "Memproses…" : "Unduh Semua Gambar"}
          </Button>
          <Button disabled={!doc || busy} onClick={() => void download()}>
            <IconFileExcel /> {busy ? "Memproses…" : "Unduh Excel"}
          </Button>
        </div>
      </header>

      {!doc ? (
        <Label
          className="bg-card/50 hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <Input accept=".xls,.xlsx,.csv" className="hidden" onChange={onPick} ref={inputRef} type="file" />
          <div className="bg-primary/10 text-primary rounded-full p-3">
            <IconUpload size={28} />
          </div>
          <div className="font-medium">{busy ? "Membaca file…" : "Pilih atau seret file RAW ke sini"}</div>
          <div className="text-muted-foreground text-sm">Format: .xls, .xlsx, .csv</div>
        </Label>
      ) : null}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {doc && stats ? (
        <>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            <IconFileSpreadsheet size={16} />
            <span className="text-foreground max-w-20 truncate font-medium">{doc.fileName}</span>
            <span>·</span>
            <span>{doc.periodLabel}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard hint={`${stats.sources} sumber`} label="Total Pasien" value={formatNumber(stats.patients)} />
            <StatCard hint="BPJS + UMUM" label="Total Fee" value={formatRupiah(stats.totalFee)} />
            <StatCard hint="Jumlah pasien BPJS" label="BPJS" value={formatNumber(stats.bpjs)} />
            <StatCard hint="Jumlah pasien UMUM" label="UMUM" value={formatNumber(stats.umum)} />
          </div>

          {doc.warnings.length > 0 ? (
            <details className="rounded-xl border bg-amber-500/5 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-amber-600 dark:text-amber-400">
                {doc.warnings.length} peringatan
              </summary>
              <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5">
                {doc.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <Tabs className="w-full">
            <Tabs.List className="w-full overflow-x-auto overflow-y-hidden">
              <Tabs.Trigger value="rincian">RINCIAN</Tabs.Trigger>
              <Tabs.Trigger value="rekap">REKAP</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Contents>
              <Tabs.Content value="rincian">
                <RincianView doc={doc} onDownloadImage={(source) => void downloadImage(source)} />
              </Tabs.Content>
              <Tabs.Content value="rekap">
                <RekapView doc={doc} />
              </Tabs.Content>
            </Tabs.Contents>
          </Tabs>
        </>
      ) : null}
    </div>
  )
}

export default App
