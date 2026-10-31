import type { Locator, Page } from '@playwright/test';

/** Checkout TokoQA dalam tiga langkah: 1 Alamat, 2 Pengiriman, 3 Pembayaran. */
export class CheckoutPage {
  readonly page: Page;
  // Langkah 1: alamat baru (akun yang baru login belum punya alamat tersimpan)
  readonly recipient: Locator;
  readonly phone: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly postalCode: Locator;
  readonly toShippingButton: Locator;
  // Langkah 2: pengiriman
  readonly toPaymentButton: Locator;
  // Langkah 3: pembayaran
  readonly coupon: Locator;
  readonly applyCouponButton: Locator;
  readonly agree: Locator;
  readonly payButton: Locator;
  // Hasil
  readonly error: Locator;
  readonly summaryTotal: Locator;
  readonly successHeading: Locator;
  readonly orderId: Locator;
  readonly orderTotal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.recipient = page.getByLabel('Nama penerima'); // nama penerima
    this.phone = page.getByLabel('Nomor HP'); // nomor HP
    this.street = page.getByLabel('Alamat jalan'); // alamat jalan
    this.city = page.getByLabel('Kota'); // kota
    this.postalCode = page.getByLabel('Kode pos'); // kode pos
    this.toShippingButton = page.getByRole('button', { name: 'Lanjut ke pengiriman' }); // tombol ke langkah 2
    this.toPaymentButton = page.getByRole('button', { name: 'Lanjut ke pembayaran' }); // tombol ke langkah 3
    this.coupon = page.getByLabel('Kode kupon (opsional)'); // kolom kupon
    this.applyCouponButton = page.getByRole('button', { name: 'Pakai kupon' }); // tombol pakai kupon
    this.agree = page.getByLabel('Saya setuju dengan syarat & ketentuan'); // checkbox persetujuan
    this.payButton = page.getByRole('button', { name: 'Bayar sekarang' }); // tombol bayar
    this.error = page.getByRole('alert'); // pesan error
    this.summaryTotal = page.getByTestId('summary-total'); // total di ringkasan
    this.successHeading = page.getByRole('heading', { name: 'Pesanan berhasil!' }); // judul halaman berhasil
    this.orderId = page.getByTestId('order-id'); // nomor pesanan
    this.orderTotal = page.getByTestId('order-total'); // total pesanan
  }

  async fillAddress(recipient: string, phone: string, street: string, city: string, postalCode: string) {
    await this.recipient.fill(recipient);
    await this.phone.fill(phone); // nomor HP
    await this.street.fill(street); // alamat jalan
    await this.city.fill(city); // kota
    await this.postalCode.fill(postalCode); // kode pos
  }

  async continueToShipping() {
    await this.toShippingButton.click();
  }

  async chooseShipping(name: string) {
    await this.page.getByLabel(name).check();
  }

  async continueToPayment() {
    await this.toPaymentButton.click();
  }

  async payWith(method: string) {
    await this.page.getByLabel(method).check();
  }

  async agreeTerms(agree = true) {
    await this.agree.setChecked(agree);
  }

  async submit() {
    await this.payButton.click();
  }

  /** Jalur cepat untuk test yang tidak sedang mengetes checkout: alamat contoh, lalu bayar. */
  async checkout(shipping = 'Reguler', payment = 'Transfer Bank') {
    await this.fillAddress('Rina Wulandari', '081234567890', 'Jl. Asia Afrika No. 8', 'Bandung', '40111');
    await this.continueToShipping(); // lanjut ke pengiriman
    await this.chooseShipping(shipping); // pilih jasa kirim
    await this.continueToPayment(); // lanjut ke pembayaran
    await this.payWith(payment); // pilih metode bayar
    await this.agreeTerms(); // centang persetujuan
    await this.submit(); // bayar
  }
}