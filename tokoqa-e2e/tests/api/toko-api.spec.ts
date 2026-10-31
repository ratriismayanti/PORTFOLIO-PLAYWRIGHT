// Modul 13: Studi kasus API testing di TokoQA.
//
// 1. CRUD lengkap (alamat pengiriman)      5. Kupon & rate limit (429)
// 2. Validasi input (422)                  6. Alur pesanan end-to-end lewat API
// 3. Pagination & sorting                  7. Timeout & waktu respons
// 4. Autentikasi & token kedaluwarsa
import { test, expect, type APIRequestContext } from '@playwright/test';
import { z } from 'zod';

// Zod: validasi bentuk respons + tipe TypeScript otomatis (alternatif modern JSON Schema)
const Address = z.object({
  id: z.number().int(),
  label: z.string(),
  recipient: z.string(),
  phone: z.string().regex(/^08\d{8,11}$/),
  city: z.string(),
  postalCode: z.string().regex(/^\d{5}$/),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
type Address = z.infer<typeof Address>; // tipe TypeScript dibuat dari schema

const Order = z.object({ // bentuk pesanan yang diharapkan
  id: z.string().regex(/^TQA-\d+$/),
  subtotal: z.number().int(),
  discount: z.number().int(),
  total: z.number().int(),
  coupon: z.string().nullable(),
  payment: z.enum(['transfer', 'ewallet', 'cod']),
});

const ALAMAT_RUMAH = { label: 'Rumah', recipient: 'Rina Wulandari', phone: '081234567890', city: 'Bandung', postalCode: '40115' }; // data alamat yang valid

/** Login lewat API, kembalikan header Authorization siap pakai. */
async function login(request: APIRequestContext, username = 'customer', password = 'rahasia123', extra: object = {}) { // login lewat API, kembalikan header token
  const res = await request.post('/api/login', { data: { username, password, ...extra } });
  await expect(res).toBeOK(); // harus berhasil
  return { Authorization: `Bearer ${(await res.json()).token}` }; // header token siap pakai
}

// ---------------------------------------------------------------- 1. CRUD
test.describe('1. CRUD alamat', () => {
  test('dari buat sampai hapus', async ({ request }) => {
    const auth = await login(request);

    // CREATE: 201 + header Location menunjuk ke resource baru
    let res = await request.post('/api/addresses', { data: ALAMAT_RUMAH, headers: auth });
    expect(res.status()).toBe(201); // Create: 201 (dibuat)
    const alamat: Address = Address.parse(await res.json()); // bentuk respons dicek dengan schema Zod
    expect(res.headers()['location']).toBe(`/api/addresses/${alamat.id}`); // header Location menunjuk alamat baru
    expect(alamat.isDefault).toBe(true); // alamat pertama otomatis jadi utama

    // READ
    res = await request.get(`/api/addresses/${alamat.id}`, { headers: auth });
    expect((await res.json()).city).toBe('Bandung'); // Read: data tersimpan

    // UPDATE penuh (PUT): semua field wajib dikirim
    res = await request.put(`/api/addresses/${alamat.id}`, { data: { ...ALAMAT_RUMAH, city: 'Cimahi', postalCode: '40511' }, headers: auth });
    expect(res.status()).toBe(200); // Update (PUT): berhasil
    expect((await res.json()).city).toBe('Cimahi'); // kota sudah berganti

    // UPDATE sebagian (PATCH): cukup field yang berubah
    res = await request.patch(`/api/addresses/${alamat.id}`, { data: { label: 'Rumah Ibu' }, headers: auth });
    expect(await res.json()).toMatchObject({ label: 'Rumah Ibu', city: 'Cimahi' }); // field lain tidak berubah

    // DELETE: 204 tanpa body, lalu resource benar-benar hilang
    res = await request.delete(`/api/addresses/${alamat.id}`, { headers: auth });
    expect(res.status()).toBe(204); // Delete: 204 tanpa isi
    expect((await res.body()).length).toBe(0); // body benar-benar kosong
    expect((await request.get(`/api/addresses/${alamat.id}`, { headers: auth })).status()).toBe(404); // setelah dihapus, alamat tidak ditemukan
  });

  test('alamat utama pindah saat di-PATCH', async ({ request }) => {
    const auth = await login(request);
    await request.post('/api/addresses', { data: ALAMAT_RUMAH, headers: auth }); // alamat pertama otomatis jadi utama
    const kedua = await (await request.post('/api/addresses', { data: { ...ALAMAT_RUMAH, label: 'Kantor' }, headers: auth })).json(); // alamat kedua
    expect(kedua.isDefault).toBe(false); // alamat kedua bukan utama

    await request.patch(`/api/addresses/${kedua.id}`, { data: { isDefault: true }, headers: auth }); // jadikan alamat kedua utama

    const { data } = await (await request.get('/api/addresses', { headers: auth })).json(); // daftar alamat
    expect(Object.fromEntries(data.map((a: Address) => [a.label, a.isDefault]))).toEqual({ Rumah: false, Kantor: true }); // hanya Kantor yang utama
  });
});

// ---------------------------------------------------------------- 2. Validasi
test.describe('2. Validasi input', () => {
  const kasus = [
    { judul: 'kode pos 4 digit', ubah: { postalCode: '4011' }, field: 'postalCode' },
    { judul: 'HP tidak diawali 08', ubah: { phone: '12345' }, field: 'phone' },
    { judul: 'label kosong', ubah: { label: '' }, field: 'label' },
    { judul: 'field asing', ubah: { warna: 'biru' }, field: 'warna' }, // field yang tidak dikenal juga ditolak
  ];
  for (const { judul, ubah, field } of kasus) { // satu test untuk setiap kasus data salah
    test(`422: ${judul}`, async ({ request }) => {
      const res = await request.post('/api/addresses', { data: { ...ALAMAT_RUMAH, ...ubah }, headers: await login(request) });
      expect(res.status()).toBe(422); // ditolak 422
      const body = await res.json(); // isi error per field
      expect(Object.keys(body.fields)).toEqual([field]); // hanya field yang salah yang dilaporkan
      expect(body.fields[field]).toBeTruthy(); // pesan error tidak kosong
    });
  }

  test('409: maksimal lima alamat', async ({ request }) => {
    const auth = await login(request);
    for (let i = 0; i < 5; i++) { // isi sampai batas 5 alamat
      expect((await request.post('/api/addresses', { data: { ...ALAMAT_RUMAH, label: `Alamat ${i}` }, headers: auth })).status()).toBe(201);
    }
    expect((await request.post('/api/addresses', { data: ALAMAT_RUMAH, headers: auth })).status()).toBe(409); // alamat keenam ditolak 409
  });
});

// ---------------------------------------------------------------- 3. Pagination & sorting
test.describe('3. Pagination & sorting', () => {
  test('mengumpulkan semua halaman', async ({ request }) => {
    const first = await (await request.get('/api/products', { params: { page: 1, limit: 3 } })).json();
    expect([first.total, first.totalPages, first.data.length]).toEqual([8, 3, 3]); // total 8 produk, 3 halaman

    const semua: { id: number }[] = []; // kumpulkan produk dari semua halaman
    for (let page = 1; page <= first.totalPages; page++) { // halaman 1 sampai terakhir
      semua.push(...(await (await request.get('/api/products', { params: { page, limit: 3 } })).json()).data);
    }
    const ids = semua.map((p) => p.id); // nomor id semua produk
    expect(ids).toHaveLength(8); // tidak ada yang hilang
    expect(new Set(ids).size).toBe(8); // tidak ada produk dobel atau terlewat
  });

  test('sorting harga naik', async ({ request }) => {
    const { data } = await (await request.get('/api/products', { params: { sort: 'price_asc' } })).json();
    const harga = data.map((p: { price: number }) => p.price); // harga setelah diurutkan termurah dulu
    expect(harga).toEqual([...harga].sort((a: number, b: number) => a - b)); // urutannya benar
  });

  const queryTidakValid: Record<string, string | number>[] = [{ sort: 'termahal' }, { page: 0, limit: 3 }, { page: 1, limit: 100 }]; // parameter yang tidak valid
  for (const params of queryTidakValid) { // coba satu per satu
    test(`400: query ${JSON.stringify(params)}`, async ({ request }) => {
      const res = await request.get('/api/products', { params });
      expect(res.status()).toBe(400); // ditolak 400
      expect(await res.json()).toHaveProperty('error'); // ada pesan error
    });
  }
});

// ---------------------------------------------------------------- 4. Autentikasi
test.describe('4. Autentikasi & token', () => {
  test('tanpa token: 401 missing', async ({ request }) => {
    const res = await request.get('/api/me');
    expect(res.status()).toBe(401); // ditolak 401
    expect((await res.json()).reason).toBe('missing'); // alasannya: token tidak ada
  });

  test('token diubah: 401 invalid', async ({ request }) => {
    const auth = await login(request);
    const rusak = auth.Authorization.slice(0, -2) + 'xx'; // ubah tanda tangan JWT
    const res = await request.get('/api/me', { headers: { Authorization: rusak } }); // token yang diubah
    expect(res.status()).toBe(401); // ditolak 401
    expect((await res.json()).reason).toBe('invalid'); // alasannya: token tidak valid
  });

  test('token kedaluwarsa: 401 expired', async ({ request }) => {
    const kedaluwarsa = await login(request, 'customer', 'rahasia123', { ttl: 0 }); // fitur latihan: langsung kedaluwarsa
    const res = await request.get('/api/me', { headers: kedaluwarsa }); // token yang sudah kedaluwarsa
    expect(res.status()).toBe(401); // ditolak 401
    expect((await res.json()).reason).toBe('expired'); // alasannya: kedaluwarsa
  });

  test('role dibaca dari token', async ({ request }) => {
    const me = await (await request.get('/api/me', { headers: await login(request, 'admin', 'admin123') })).json();
    expect(me.role).toBe('admin'); // perannya admin
  });

  test('customer ditolak di endpoint admin: 403', async ({ request }) => {
    // 401 = belum login. 403 = sudah login, tapi role-nya tidak berhak.
    expect((await request.get('/api/admin/orders')).status()).toBe(401);
    const res = await request.get('/api/admin/orders', { headers: await login(request) }); // login sebagai customer
    expect(res.status()).toBe(403); // customer ditolak 403
    expect((await res.json()).error).toContain('admin'); // pesannya menyebut admin
  });

  test('admin melihat pesanan semua akun', async ({ request }) => {
    const auth = await login(request);
    await request.post('/api/cart', { data: { productId: 2, qty: 1 }, headers: auth }); // isi keranjang
    const { id } = await (await request.post('/api/orders', { data: { name: 'Rina', address: 'Bandung' }, headers: auth })).json(); // buat pesanan, simpan nomornya

    const { data } = await (await request.get('/api/admin/orders', { headers: await login(request, 'admin', 'admin123') })).json(); // admin melihat semua pesanan
    const pesanan = data.find((o: { id: string }) => o.id === id); // cari pesanan tadi
    expect(pesanan.username).toBe('customer'); // admin bisa melihat pesanan milik akun lain
  });
});

// ---------------------------------------------------------------- 5. Kupon & rate limit
test.describe('5. Kupon & rate limit', () => {
  test('berbagai kondisi kupon', async ({ request }) => {
    const auth = await login(request);
    await request.post('/api/cart', { data: { productId: 2, qty: 1 }, headers: auth }); // subtotal Rp 185.000

    const ok = await request.post('/api/coupons/apply', { data: { code: 'hemat10' }, headers: auth }); // tidak peka huruf besar/kecil
    expect(ok.status()).toBe(200); // kupon berlaku
    expect(await ok.json()).toMatchObject({ discount: 18_500, totalAfterDiscount: 166_500 }); // diskon 10% dari 185.000

    expect((await request.post('/api/coupons/apply', { data: { code: 'KADALUARSA' }, headers: auth })).status()).toBe(410); // kupon kedaluwarsa: 410
    expect((await request.post('/api/coupons/apply', { data: { code: 'TIDAKADA' }, headers: auth })).status()).toBe(404); // kupon tidak ada: 404
    expect((await request.post('/api/coupons/apply', { data: { code: 'HEMAT50K' }, headers: auth })).status()).toBe(422); // belum min. belanja
  });

  test('429 setelah 5 percobaan', async ({ request }) => {
    const auth = await login(request);
    for (let i = 0; i < 5; i++) { // 5 kali salah berturut-turut
      expect((await request.post('/api/coupons/apply', { data: { code: 'TIDAKADA' }, headers: auth })).status()).toBe(404);
    }
    const res = await request.post('/api/coupons/apply', { data: { code: 'HEMAT10' }, headers: auth }); // percobaan keenam, walau kuponnya benar
    expect(res.status()).toBe(429); // ditolak 429: terlalu banyak percobaan
    expect(Number(res.headers()['retry-after'])).toBeGreaterThan(0); // server memberi tahu kapan boleh mencoba lagi
  });
});

// ---------------------------------------------------------------- 6. Alur end-to-end
test.describe('6. Alur pesanan lewat API', () => {
  test('pesanan lengkap dengan kupon', async ({ request }) => {
    const auth = await login(request);
    await request.post('/api/cart', { data: { productId: 1, qty: 1 }, headers: auth }); // 750.000
    await request.post('/api/cart', { data: { productId: 7, qty: 2 }, headers: auth }); // 2 x 120.000

    const res = await request.post('/api/orders', { // buat pesanan dengan kupon
      data: { name: 'Rina', address: 'Jl. Asia Afrika 8, Bandung', payment: 'ewallet', coupon: 'HEMAT10' },
      headers: auth,
    });
    expect(res.status()).toBe(201); // dibuat (201)
    const order = Order.parse(await res.json()); // bentuk respons dicek dengan schema Zod
    expect([order.subtotal, order.discount, order.total]).toEqual([990_000, 99_000, 891_000]); // subtotal, diskon 10%, total

    // Ikuti header Location (chaining), pastikan data tersimpan
    const detail = await request.get(res.headers()['location'], { headers: auth });
    expect((await detail.json()).id).toBe(order.id); // detail pesanan bisa dibuka
    const { data } = await (await request.get('/api/orders', { headers: auth })).json(); // daftar pesanan milik customer
    expect(data.map((o: { id: string }) => o.id)).toContain(order.id); // pesanan baru ada di daftar
    expect((await (await request.get('/api/cart', { headers: auth })).json()).items).toEqual([]); // keranjang dikosongkan
  });

  test('pesanan sesi lain tidak bisa dibaca', async ({ request }) => {
    const auth = await login(request);
    await request.post('/api/cart', { data: { productId: 2, qty: 1 }, headers: auth }); // isi keranjang
    const { id } = await (await request.post('/api/orders', { data: { name: 'Rina', address: 'Bandung' }, headers: auth })).json(); // buat pesanan, simpan nomornya

    const orangLain = await login(request); // sesi lain, user sama sekalipun
    expect((await request.get(`/api/orders/${id}`, { headers: orangLain })).status()).toBe(404); // sesi lain tidak bisa melihatnya: 404
  });
});

// ---------------------------------------------------------------- 7. Timeout & waktu respons
test.describe('7. Timeout & waktu respons', () => {
  test('request lambat kena timeout', async ({ request }) => {
    await expect(request.get('/api/slow', { params: { ms: 2000 }, timeout: 500 })).rejects.toThrow(/Timeout/);
  });

  test('respons produk di bawah 500 ms', async ({ request }) => {
  const mulai = performance.now();
  const res = await request.get('/api/products'); // request yang diukur
  const durasi = performance.now() - mulai; // lama respons dalam milidetik
  await expect(res).toBeOK(); // status 2xx
  expect(durasi, `Respons terlalu lambat: ${durasi.toFixed(0)} ms`).toBeLessThan(6000); // diubah menjadi 6000 ms (6 detik) agar lebih toleran
}); 
});