import 'dotenv/config'; // Pastikan dotenv dimuat di baris paling atas
// Custom fixtures untuk TokoQA
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ShopPage } from '../pages/ShopPage';
import { CheckoutPage } from '../pages/CheckoutPage';

type Fixtures = {
  loginPage: LoginPage;
  shopPage: ShopPage;
  checkoutPage: CheckoutPage;
  loggedInShop: ShopPage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  shopPage: async ({ page }, use) => {
    await use(new ShopPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  // Login sebagai customer lewat UI pakai kredensial dari .env
  loggedInShop: async ({ loginPage, shopPage }, use) => {
    await loginPage.open();
    await loginPage.login(process.env.TOKOQA_USERNAME!, process.env.TOKOQA_PASSWORD!);
    await expect(shopPage.greeting).toContainText('Halo');
    await use(shopPage);
  }
});

export { expect };