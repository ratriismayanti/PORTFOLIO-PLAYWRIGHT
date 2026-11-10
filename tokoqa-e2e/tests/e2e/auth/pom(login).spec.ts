
import {
  test,
  expect
} from '../../../src/fixtures/index';

import { wajibEnv } from '../../../src/utils/env';

// Customer berhasil login.
test(
  'Customer dapat login dengan kredensial valid',
  async ({ loginPage, shopPage }) => {

    await loginPage.open();

    await loginPage.login(
      wajibEnv('TOKOQA_USERNAME'),
      wajibEnv('TOKOQA_PASSWORD')
    );

    await expect(shopPage.greeting)
      .toHaveText('Halo, Rina Wulandari');

  }
);

// Customer gagal login dengan password yang salah.
test(
  'Customer tidak dapat login dengan password salah',
  async ({ loginPage }) => {

    await loginPage.open();

    await loginPage.login(
      wajibEnv('TOKOQA_USERNAME'),
      'password-salah-untuk-test'
    );

    await expect(loginPage.error)
      .toHaveText('Username atau password salah');

  }
);

// Customer berhasil mencari produk.
test(
  'Customer dapat menemukan Mouse Wireless melalui pencarian',
  async ({ loggedInShop }) => {

    await loggedInShop.search('mouse');

    await expect(loggedInShop.productCards)
      .toHaveCount(1);

    await expect(
      loggedInShop.product('Mouse Wireless')
    ).toBeVisible();

  }
);

// Customer berhasil memfilter kategori.
test(
  'Customer dapat melihat produk kategori Furnitur',
  async ({ loggedInShop }) => {

    await loggedInShop.filterCategory('Furnitur');

    await expect(loggedInShop.productCards)
      .toHaveCount(2);

  }
);
