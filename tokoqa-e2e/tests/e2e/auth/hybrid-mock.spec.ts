
import {
  test,
  expect
} from '../../../src/fixtures/index';

const SHOP = '/shop.html';

const ARENA = '/arena.html';

// ==================================================
// 1. LOGIN API, KEMUDIAN BUKA UI
// ==================================================

test(
  'Customer dapat membuka toko menggunakan sesi login API',
  async ({ page, customerSession }) => {

    // Masukkan token sebelum halaman dibuka.
    await page.addInitScript((token) => {

      window.localStorage.setItem(
        'tokoqa_token',
        token
      );

    }, customerSession.token);

    await page.goto(SHOP);

    await expect(
      page.getByTestId('greeting')
    ).toHaveText('Halo, Rina Wulandari');

  }
);


// ==================================================
// 2. SIAPKAN CART LEWAT API, CEK MELALUI UI
// ==================================================

test(
  'Produk yang ditambahkan melalui API muncul di keranjang toko',
  async ({ page, api, customerSession }) => {

    // Tambahkan Keyboard melalui API.
    const keyboard = await api.addToCart(
      customerSession.token,
      {
        productId: 1,
        qty: 1
      }
    );

    expect(keyboard.status()).toBe(201);

    // Tambahkan dua Lampu Meja melalui API.
    const lampu = await api.addToCart(
      customerSession.token,
      {
        productId: 7,
        qty: 2
      }
    );

    expect(lampu.status()).toBe(201);

    // Siapkan login di browser.
    await page.addInitScript((token) => {

      window.localStorage.setItem(
        'tokoqa_token',
        token
      );

    }, customerSession.token);

    await page.goto(SHOP);

    // Periksa jumlah barang.
    await expect(
      page.getByTestId('cart-count')
    ).toHaveText('3');

    // Periksa total harga.
    await expect(
      page.getByTestId('cart-total')
    ).toHaveText('Rp 990.000');

  }
);


// ==================================================
// 3. MOCK RESPONSE API
// ==================================================

test(
  'Website menampilkan data produk dari respons API palsu',
  async ({ page }) => {

    await page.route('**/api/products', async (route) => {

      await route.fulfill({
        json: {
          total: 1,
          data: [
            {
              id: 99,
              name: 'Produk Palsu'
            }
          ]
        }
      });

    });

    await page.goto(ARENA);

    await page.getByRole('button', {
      name: 'Ambil produk'
    }).click();

    await expect(
      page.getByTestId('api-count')
    ).toHaveText('1 produk');

    await expect(
      page.locator('#api-list li')
    ).toHaveText(['Produk Palsu']);

  }
);


// ==================================================
// 4. SIMULASI SERVER ERROR
// ==================================================

test(
  'Website menampilkan pesan ketika API produk mengalami server error',
  async ({ page }) => {

    await page.route('**/api/products', async (route) => {

      await route.fulfill({
        status: 500,
        json: {
          error: 'boom'
        }
      });

    });

    await page.goto(ARENA);

    await page.getByRole('button', {
      name: 'Ambil produk'
    }).click();

    await expect(
      page.getByTestId('api-count')
    ).toHaveText(
      'Gagal memuat: Server error (500)'
    );

  }
);


// ==================================================
// 5. MEMERIKSA RESPONS ASLI
// ==================================================

test(
  'API mengembalikan delapan produk ketika tombol Ambil produk diklik',
  async ({ page }) => {

    await page.goto(ARENA);

    // Mulai menunggu respons sebelum tombol diklik.
    const responsePromise = page.waitForResponse(
      '**/api/products'
    );

    await page.getByRole('button', {
      name: 'Ambil produk'
    }).click();

    const response = await responsePromise;

    expect(response.ok()).toBe(true);

    const body = await response.json();

    expect(body.total).toBe(8);

  }
);
