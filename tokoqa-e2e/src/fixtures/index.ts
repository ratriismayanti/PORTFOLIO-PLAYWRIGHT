
import {
  test as base,
  expect
} from '@playwright/test';

import {
  TokoQAApi,
  type ApiSession
} from '../api/TokoQAApi';

import {
  muatKontrak,
  type ApiContract
} from '../api/ApiContract';

import { LoginPage } from '../pages/LoginPage';
import { ShopPage } from '../pages/ShopPage';
import { CheckoutPage } from '../pages/CheckoutPage';

import { wajibEnv } from '../utils/env';

// Daftar fasilitas tambahan yang bisa dipakai test.
type Fixtures = {

  // Fasilitas untuk UI Testing.
  loginPage: LoginPage;
  shopPage: ShopPage;
  checkoutPage: CheckoutPage;
  loggedInShop: ShopPage;

  // Fasilitas untuk API Testing.
  api: TokoQAApi;
  customerSession: ApiSession;
  adminSession: ApiSession;

  // Fasilitas untuk Contract Testing.
  apiContract: ApiContract;
};

export const test = base.extend<Fixtures>({

  // ================================================
  // UI FIXTURES
  // ================================================

  loginPage: async ({ page }, use) => {

    await use(new LoginPage(page));

  },

  shopPage: async ({ page }, use) => {

    await use(new ShopPage(page));

  },

  checkoutPage: async ({ page }, use) => {

    await use(new CheckoutPage(page));

  },

  // Login customer melalui UI.
  loggedInShop: async (
    { loginPage, shopPage },
    use
  ) => {

    await loginPage.open();

    await loginPage.login(
      wajibEnv('TOKOQA_USERNAME'),
      wajibEnv('TOKOQA_PASSWORD')
    );

    await expect(shopPage.greeting)
      .toContainText('Halo');

    await use(shopPage);

  },

  // ================================================
  // API FIXTURES
  // ================================================

  // Membuat alat untuk mengirim API request.
  api: async ({ request }, use) => {

    await use(new TokoQAApi(request));

  },

  // Menyiapkan sesi customer melalui API.
  // Fixture ini hanya dijalankan ketika test memintanya.
  customerSession: async ({ api }, use) => {

    const session = await api.loginSession(
      wajibEnv('TOKOQA_USERNAME'),
      wajibEnv('TOKOQA_PASSWORD')
    );

    await use(session);

  },

  // Menyiapkan sesi admin melalui API.
  adminSession: async ({ api }, use) => {

    const session = await api.loginSession(
      wajibEnv('TOKOQA_ADMIN_USERNAME'),
      wajibEnv('TOKOQA_ADMIN_PASSWORD')
    );

    await use(session);

  },

  // Memuat OpenAPI Spec untuk contract test.
  apiContract: async ({ request }, use) => {

    const contract = await muatKontrak(
      request,
      'tokoqa'
    );

    await use(contract);

  }

});

export { expect };
