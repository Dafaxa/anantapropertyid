# Foto 360° (panorama)

Folder ini berisi panorama untuk penampil 360° di halaman proyek.

## Syarat file

- **Equirectangular**, perbandingan sisi **2:1** (lebar dua kali tinggi). Foto biasa/render datar tidak bisa dipakai — hasilnya akan melengkung.
- Ukuran disarankan **4096 × 2048** piksel (cukup tajam, ukuran file wajar). Maksimal 8192 × 4096.
- Format **JPEG**, kualitas 80–85. Usahakan di bawah 2 MB per file agar cepat dibuka di ponsel.
- Penamaan: `<proyek>-<ruangan>.jpg`, misalnya `residences-living.jpg`, `sky-suites-bedroom.jpg`.

## Cara memasang

Buka halaman proyeknya (`residences.html`, `sky-suites.html`, `grand-masterplan.html`), cari blok
`<script type="application/json" data-pano-config>` di dalam panel tur, lalu isi `src` tiap ruangan:

```json
{"id":"Living","label":"Living","src":"assets/img/360/residences-living.jpg","poster":"","x":34,"y":60,"heading":0}
```

- `src` — panorama 360°. Kalau dikosongkan, penampil menampilkan keterangan "akan menyusul".
- `poster` — render datar biasa sebagai latar sementara selama `src` masih kosong (opsional).
- `x`, `y` — posisi ruangan di mini denah, skala 0–100 (0,0 = kiri atas).
- `heading` — arah pandang awal dalam derajat (0 = menghadap tengah panorama).

`id` harus sama persis dengan `data-choice` pada tombol ruangan di bawah panel tur.

## Catatan

- `test-pano.jpg` hanya gambar uji berpola grid. Hapus setelah panorama asli terpasang.
- Mini denah saat ini berupa skema titik. Kalau nanti ada gambar denah asli, denah itu bisa dipasang sebagai latar mini denah.
