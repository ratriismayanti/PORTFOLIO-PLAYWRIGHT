import type { Locator, Page } from '@playwright/test';

export class ShopPage {
  static readonly URL = '/shop.html';

  readonly page: Page;
  readonly greeting: Locator;
  readonly searchBox: Locator;
  readonly category: Locator;
  readonly productCards: Locator;
  readonly cartCount: Locator;
  readonly cartTotal: Locator;
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.greeting = page.getByTestId('greeting'); // sapaan di header
    this.searchBox = page.getByLabel('Cari produk'); // kolom pencarian
    this.category = page.getByLabel('Kategori'); // dropdown kategori
    this.productCards = page.getByTestId('product-card'); // semua kartu produk
    this.cartCount = page.getByTestId('cart-count'); // angka di ikon keranjang
    this.cartTotal = page.getByTestId('cart-total'); // total harga keranjang
    this.cartItems = page.getByTestId('cart-item'); // baris di dalam keranjang
    this.checkoutButton = page.getByRole('button', { name: 'Checkout' }); // tombol Checkout
  }

  async open() {
    await this.page.goto(ShopPage.URL);
  }

  async search(keyword: string) {
    await this.searchBox.fill(keyword);
  }

  async filterCategory(name: string) {
    await this.category.selectOption(name);
  }

  product(name: string): Locator {
    return this.productCards.filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  async addToCart(name: string) {
    await this.product(name).getByRole('button', { name: 'Tambah ke keranjang' }).click();
  }

  async removeFromCart(name: string) {
    await this.page.getByRole('button', { name: `Hapus ${name}` }).click();
  }

  async goToCheckout() {
    await this.checkoutButton.click();
  }
}