import type { Locator, Page } from '@playwright/test';

/** Halaman login TokoQA: simpan locator di satu tempat, ekspos aksi yang bermakna. */
export class LoginPage {
  static readonly URL = '/login-toko.html';

  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.getByLabel('Username'); // kolom Username
    this.password = page.getByLabel('Password'); // kolom Password
    this.submitButton = page.getByRole('button', { name: 'Masuk' }); // tombol Masuk
    this.error = page.getByRole('alert'); // pesan error login
  }

  async open() {
    await this.page.goto(LoginPage.URL);
  }

  async login(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password); // isi Password
    await this.submitButton.click(); // klik Masuk
  }
}