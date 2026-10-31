// Modul 10 — Page Object Model. Bandingkan betapa bersihnya test ini dibanding Modul 7.
import { test, expect } from '../../../src/fixtures/index';

test('login berhasil', async ({ loginPage, shopPage }) => {
  await loginPage.open();
  await loginPage.login('customer', 'rahasia123'); // isi form dan klik Masuk dalam satu langkah
  await expect(shopPage.greeting).toHaveText('Halo, Rina Wulandari'); // locator sapaan disimpan di ShopPage
});

test('login gagal', async ({ loginPage }) => {
  await loginPage.open();
  await loginPage.login('customer', 'salah'); // password salah
  await expect(loginPage.error).toHaveText('Username atau password salah'); // locator pesan error disimpan di LoginPage
});

test('cari produk', async ({ loggedInShop }) => {
  await loggedInShop.search('mouse');
  await expect(loggedInShop.productCards).toHaveCount(1); // tersisa 1 kartu produk
  await expect(loggedInShop.product('Mouse Wireless')).toBeVisible(); // kartu Mouse Wireless terlihat
});

test('filter kategori', async ({ loggedInShop }) => {
  await loggedInShop.filterCategory('Furnitur');
  await expect(loggedInShop.productCards).toHaveCount(2); // 2 produk furnitur
});