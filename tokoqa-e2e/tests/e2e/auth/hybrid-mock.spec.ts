// Modul 13 — Hybrid testing (API + UI) dan network mocking.
import { test, expect } from '@playwright/test';

const SHOP = '/shop.html'; // halaman toko
const ARENA = '/arena.html'; // halaman latihan interaksi

test.describe('hybrid: login lewat API', () => {
  let token: string;

  test.beforeEach(async ({ request }) => { // login lewat API sebelum setiap test
    // Login lewat API (cepat!) dan ambil JWT token-nya
    const res = await request.post('/api/login', {
      data: { username: process.env.TOKOQA_USERNAME, password: process.env.TOKOQA_PASSWORD },
    });
    token = (await res.json()).token; // simpan token untuk dipakai test
  });

  test('bypass login UI dengan token', async ({ page }) => {
    // Taruh token di localStorage SEBELUM halaman dimuat → aplikasi menganggap kita sudah login
    await page.addInitScript((t) => window.localStorage.setItem('tokoqa_token', t), token);
    await page.goto(SHOP); // buka toko
    await expect(page.getByTestId('greeting')).toHaveText('Halo, Rina Wulandari'); // sudah masuk tanpa mengisi form
  });

  test('siapkan data lewat API, cek di UI', async ({ page }) => {
    const headers = { Authorization: `Bearer ${token}` };
    await page.request.post('/api/cart', { data: { productId: 1, qty: 1 }, headers }); // siapkan keranjang lewat API: 1 Keyboard
    await page.request.post('/api/cart', { data: { productId: 7, qty: 2 }, headers }); // dan 2 Lampu Meja

    await page.addInitScript((t) => window.localStorage.setItem('tokoqa_token', t), token); // simpan token sebelum halaman dimuat, jadi browser sudah login
    await page.goto(SHOP); // buka toko

    await expect(page.getByTestId('cart-count')).toHaveText('3'); // UI menampilkan isi keranjang dari API
    await expect(page.getByTestId('cart-total')).toHaveText('Rp 990.000'); // total 750.000 + 2 x 120.000
  });
});

test('mock respons API', async ({ page }) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({ json: { total: 1, data: [{ id: 99, name: 'Produk Palsu' }] } }), // balas dengan data palsu, request tidak sampai ke server
  );
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Ambil produk' }).click(); // halaman memanggil API

  await expect(page.getByTestId('api-count')).toHaveText('1 produk'); // halaman menampilkan data palsu
  await expect(page.locator('#api-list li')).toHaveText(['Produk Palsu']); // isi daftar sesuai data palsu
});

test('simulasi server error', async ({ page }) => {
  await page.route('**/api/products', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await page.goto(ARENA); // buka Arena
  await page.getByRole('button', { name: 'Ambil produk' }).click(); // halaman memanggil API
  await expect(page.getByTestId('api-count')).toHaveText('Gagal memuat: Server error (500)'); // pesan error tampil di halaman
});

test('intip respons asli', async ({ page }) => {
  await page.goto(ARENA);
  const responsePromise = page.waitForResponse('**/api/products'); // mulai menunggu respons dari URL ini
  await page.getByRole('button', { name: 'Ambil produk' }).click(); // klik tombol yang memanggil API
  const response = await responsePromise; // respons yang ditangkap
  expect(response.ok()).toBe(true); // status 2xx
  expect((await response.json()).total).toBe(8); // isi respons berisi 8 produk
});