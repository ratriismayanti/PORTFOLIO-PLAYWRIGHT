import { test, expect } from '../../../src/fixtures/index';
import checkoutCases from '../../../test-data/checkout-cases.json';

// Modul 17 — Proyek akhir: alur belanja TokoQA dari login sampai pesanan berhasil.

test('belanja end-to-end', { tag: '@smoke' }, async ({ loggedInShop: shop, checkoutPage }) => {
  await shop.filterCategory('Elektronik');
  await expect(shop.productCards).toHaveCount(4); // 4 produk Elektronik

  await shop.addToCart('Keyboard Mekanik'); // tambah Keyboard Mekanik
  await expect(shop.cartCount).toHaveText('1'); // keranjang 1
  await shop.addToCart('Mouse Wireless'); // tambah Mouse Wireless
  await expect(shop.cartCount).toHaveText('2'); // keranjang 2
  await expect(shop.cartTotal).toHaveText('Rp 935.000'); // total 750.000 + 185.000

  await shop.goToCheckout(); // mulai checkout
  await checkoutPage.fillAddress('Rina Wulandari', '081234567890', 'Jl. Automation No. 1', 'Jakarta', '10110'); // langkah 1: alamat
  await checkoutPage.continueToShipping(); // lanjut ke pengiriman
  await checkoutPage.chooseShipping('Reguler'); // gratis ongkir, jadi total tetap Rp 935.000
  await checkoutPage.continueToPayment(); // langkah 2 selesai (Reguler)
  await checkoutPage.payWith('E-Wallet'); // langkah 3: metode pembayaran
  await checkoutPage.agreeTerms(); // centang persetujuan
  await checkoutPage.submit(); // bayar

  await expect(checkoutPage.successHeading).toBeVisible(); // halaman berhasil
  await expect(checkoutPage.orderId).toHaveText(/^TQA-\d+$/); // nomor pesanan berpola TQA- diikuti angka
  await expect(checkoutPage.orderTotal).toHaveText('Rp 935.000'); // total sama dengan keranjang
});

test('produk stok habis tidak bisa dibeli', { tag: '@regression' }, async ({ loggedInShop }) => {
  const tombol = loggedInShop.product('Tas Laptop').getByRole('button', { name: 'Tambah ke keranjang' });
  await expect(tombol).toBeDisabled(); // stok habis: tidak bisa diklik
});

test('dashboard admin hanya untuk admin', { tag: '@regression' }, async ({ loggedInShop , loginPage, page }) => {
  // Customer (dari fixture loggedInShop) ditolak saat membuka dashboard admin
  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible(); // customer ditolak di halaman admin

  // Admin langsung diarahkan ke dashboard setelah login, bukan ke toko
  await loginPage.open();
  await loginPage.login('admin', 'admin123'); // login sebagai admin
  await expect(page).toHaveURL(/admin\.html$/); // admin diarahkan ke dashboard
  await expect(page.getByRole('heading', { name: 'Dashboard admin' })).toBeVisible(); // judul dashboard
  await expect(page.getByTestId('admin-low-stock')).toContainText('Tas Laptop (0)'); // Tas Laptop masuk daftar stok habis
});

test('hapus item dari keranjang', { tag: '@regression' }, async ({ loggedInShop: shop }) => {
  await shop.addToCart('Lampu Meja LED');
  await expect(shop.cartItems).toHaveCount(1); // keranjang berisi 1 baris

  await shop.removeFromCart('Lampu Meja LED'); // hapus dari keranjang
  await expect(shop.cartItems).toHaveCount(0); // keranjang kosong
  await expect(shop.checkoutButton).toBeDisabled(); // checkout tidak bisa diklik saat keranjang kosong
});

// Data-driven test untuk validasi form checkout negatif
for (const data of checkoutCases) {
  test(`validasi form checkout: ${data.scenario}`, async ({ loggedInShop, checkoutPage }) => {
    await loggedInShop.search('Mouse Wireless');
    await loggedInShop.addToCart('Mouse Wireless');
    await loggedInShop.goToCheckout();

    await checkoutPage.fillAddress(data.recipient, data.phone, data.street, data.city, data.postalCode);
    await checkoutPage.continueToShipping();

    // Assertion pesan error muncul
    await expect(checkoutPage.error).toContainText(data.expectedError);
  });
}