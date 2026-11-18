# PRD — Rujuk Rekap

Versi: 1.0
Status: MVP selesai (fungsional)
Terakhir diperbarui: 2026

---

## 1. Ringkasan

Rujuk Rekap adalah aplikasi web (browser-only) yang mengubah file rujukan pasien mentah berformat RAW (.xls/.xlsx) menjadi laporan FINAL (.xlsx) yang rapi, terdiri dari dua sheet: RINCIAN dan REKAP.

Aplikasi berjalan sepenuhnya di sisi klien — file tidak pernah diunggah ke server mana pun, sehingga data pasien tetap aman di perangkat pengguna.

---

## 2. Latar Belakang & Masalah

Setiap periode (bulanan), mitra (bidan, klinik, PKM, dokter) mengirimkan data rujukan pasien dalam satu file Excel berisi banyak sheet. Setiap sheet dapat memuat satu atau lebih blok data dengan struktur berulang:


DARI              |            |          | PERIODE
                  | <Nama>     |
TANGGAL           | NAMA PASIEN| ALAMAT   | TINDAKAN | UMUM/BPJS | FEE
<tanggal>         | ...        | ...      | ...      | ...       | <fee>
...
TOTAL             |            |          |          |           | <total>


Menyusun ulang data ini secara manual menjadi rekap memakan waktu, rawan salah hitung, dan tidak konsisten antarperiode.

Tujuan: otomatisasi konversi RAW → FINAL secara akurat, cepat, dan konsisten.

---

## 3. Target Pengguna

- Admin/Staf keuangan yang menerima laporan rujukan dari banyak mitra.
- Koordinator mitra yang perlu memverifikasi total fee per sumber.

---

## 4. Ruang Lingkup MVP (Sudah Diimplementasikan)

### 4.1 Input
- Unggah file melalui tombol Pilih file atau drag & drop.
- Format didukung: .xls, .xlsx, .csv.
- Parsing seluruh sheet; sheet dengan struktur blok DARI → TANGGAL → TOTAL dikenali otomatis.
- Satu sheet boleh memuat lebih dari satu blok.
- Sheet tanpa blok valid dilewati (dicatat sebagai skippedSheets).

### 4.2 Validasi & Peringatan
- Menghitung total per blok dan membandingkan dengan baris TOTAL tertulis → memunculkan peringatan jika tidak cocok.
- Peringatan jika nama sumber kosong.
- Error jelas jika file tidak memiliki blok rujukan yang valid.

### 4.3 Tampilan (View)
- Kartu statistik: total pasien, total fee, jumlah BPJS, jumlah UMUM.
- Tab RINCIAN: tabel per sumber (Tanggal, Nama, Alamat, Tindakan, Jenis, Fee) + baris TOTAL.
- Tab REKAP: tabel NO | NAMA | TOTAL per sumber + grand total.
- Badge warna untuk jenis (BPJS / UMUM).
- Tombol unduh gambar PNG pada setiap tabel RINCIAN.
- Tombol unduh semua gambar RINCIAN sebagai satu arsip ZIP.
- Dukungan mode gelap/terang (tombol d).

### 4.4 Output & Download
- Tombol Unduh FINAL menghasilkan file .xlsx dengan dua sheet:
  - RINCIAN — semua blok digabung berurutan, dipisah satu baris kosong, dengan layout FINAL (header DARI/PERIODE, header kolom, baris data, baris TOTAL).
  - REKAP — daftar NO | NAMA | TOTAL untuk setiap sumber + baris TOTAL keseluruhan dengan format Rupiah.
  - Styling workbook — header dan total berwarna, border tabel, alignment, format tanggal/Rupiah, merge header, lebar kolom, freeze pane, dan pengaturan cetak.
- Nama file otomatis: (RAW) diganti menjadi (FINAL).xlsx.

### 4.5 Akurasi
Parser telah diverifikasi terhadap data contoh: 26 sumber, grand total Rp 23.350.000, identik dengan file FINAL referensi.

---

## 5. Non-Goals (MVP)

- Tidak ada backend/database — sepenuhnya client-side.
- Tidak ada autentikasi/multi-user.
- Tidak ada penyuntingan data di dalam aplikasi (hanya baca + ekspor).
- Tidak ada penggabungan beberapa file sekaligus.
- Tidak ada integrasi langsung ke sistem keuangan.

---

## 6. Arsitektur Teknis

| Lapisan | Teknologi |
|---|---|
| UI | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/base-ui |
| Ikon | @tabler/icons-react |
| Parsing & ekspor Excel | xlsx (SheetJS) |
| Lint/format | Biome |

Modul kunci:
- src/lib/rujukan.ts — tipe data, parsing workbook, statistik, helper format.
- src/lib/exporter.ts — membangun workbook FINAL (RINCIAN + REKAP) dan memicu unduhan.
- src/App.tsx — alur unggah, pratinjau tabel, unduh.

Alur data:

File RAW → readRujukanFile() → RujukanDocument
         → (UI) Statistik + Tab RINCIAN/REKAP
         → buildFinalWorkbook() → downloadFinal() → FINAL.xlsx


---

## 7. Kriteria Penerimaan

- [x] Dapat mengunggah file RAW dan menampilkan pratinjau RINCIAN & REKAP.
- [x] Total per sumber dan grand total cocok dengan file FINAL referensi.
- [x] Tombol unduh menghasilkan .xlsx dengan sheet RINCIAN dan REKAP.
- [x] Nama file output mengikuti pola (FINAL).xlsx.
- [x] Data tidak dikirim ke server.
- [x] Workbook FINAL memiliki styling yang dapat dibaca dan siap dicetak.
- [x] Setiap tabel RINCIAN dapat diunduh sebagai gambar PNG.
- [x] Semua gambar RINCIAN dapat diunduh sekaligus sebagai arsip ZIP.

---

## 8. Roadmap Pengembangan Selanjutnya

### Fase 1 — Peningkatan UX
- Simpan dokumen terakhir di localStorage (restore saat reload).
- Mode edit inline pada tabel RINCIAN (ubah nama, tindakan, fee) sebelum ekspor.
- Filter & pencarian per sumber / jenis / tindakan.
- Ekspor PDF selain Excel.

### Fase 2 — Kolaborasi & Batch
- Unggah dan gabungkan beberapa file sekaligus.
- Pemetaan kolom kustom (jika format mitra berbeda).
- Template ekspor yang dapat dikonfigurasi (urutan kolom, header).

### Fase 3 — Validasi & Analitik
- Deteksi duplikat pasien (nama + tanggal).
- Ringkasan analitik: tren fee per bulan, proporsi BPJS/UMUM, top tindakan.
- Rekonsiliasi otomatis terhadap total tertulis mitra.

### Fase 4 — Integrasi (opsional)
- Sinkronisasi ke Google Sheets / penyimpanan cloud (dengan persetujuan).
- Riwayat ekspor dan audit log.

---

## 9. Risiko & Catatan

- Variasi format mitra: struktur DARI/TANGGAL/TOTAL diasumsikan konsisten; mitra dengan format berbeda perlu pemetaan (Fase 2).
- Tanggal campuran: sebagian tanggal berupa serial Excel, sebagian teks (dd/mm/yyyy); helper dateText/dateSortKey menangani keduanya.
- Baris fee kosong (mis. berisi spasi) diperlakukan sebagai 0.
- Privasi: karena client-side, tidak ada risiko kebocoran server, tetapi pengguna bertanggung jawab atas keamanan perangkat.

---

## 10. Cara Menjalankan

bash
npm install      # atau: bun install
npm run dev      # server pengembangan
npm run build    # build produksi
npm run typecheck
npm run lint

