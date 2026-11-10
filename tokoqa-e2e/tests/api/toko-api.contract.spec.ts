
import { randomUUID } from 'node:crypto';

import type { APIResponse } from '@playwright/test';

import { test, expect } from '../../src/fixtures/index';

import { wajibEnv } from '../../src/utils/env';

import type { ApiContract } from '../../src/api/ApiContract';

// Memeriksa status yang diharapkan dan bentuk response.
async function cek(
  contract: ApiContract,
  method: string,
  path: string,
  response: APIResponse,
  expectedStatus: number
): Promise<void> {

  expect(
    response.status(),
    `${method} ${path}: status tidak sesuai`
  ).toBe(expectedStatus);

  await contract.cek(
    method,
    path,
    response
  );

}

// Membuat alamat dummy yang berbeda untuk setiap test.
function buatAlamat() {

  const id = randomUUID().slice(0, 8);

  return {
    label: `QA-${id}`,
    recipient: `QA Tester ${id}`,
    phone: '081234567890',
    street: `Jl. Test Automation ${id}`,
    city: 'Bandung',
    postalCode: '40111'
  };

}

// ==================================================
// 1. LOGIN
// ==================================================

test(
  'API menolak login customer dengan password salah',
  async ({ api, apiContract }) => {

    const response = await api.login(
      wajibEnv('TOKOQA_USERNAME'),
      'password-salah-untuk-test'
    );

    // Login yang salah harus ditolak oleh server.
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);

    await apiContract.cek(
      'POST',
      '/api/login',
      response
    );

  }
);


test(
  'API memberikan token ketika customer login dengan kredensial valid',
  async ({ api, apiContract }) => {

    const response = await api.login(
      wajibEnv('TOKOQA_USERNAME'),
      wajibEnv('TOKOQA_PASSWORD')
    );

    expect(response.ok()).toBe(true);

    await apiContract.cek(
      'POST',
      '/api/login',
      response
    );

    const body = await response.json() as {
      token?: unknown;
    };

    expect(typeof body.token).toBe('string');
    expect((body.token as string).length).toBeGreaterThan(0);

  }
);


// ==================================================
// 2. PROFIL CUSTOMER
// ==================================================

test(
  'API profil customer hanya dapat diakses dengan token valid',
  async ({ api, apiContract, customerSession }) => {

    // Tanpa token.
    const tanpaToken = await api.getMe();

    await cek(
      apiContract,
      'GET',
      '/api/me',
      tanpaToken,
      401
    );

    // Dengan token customer.
    const denganToken = await api.getMe(
      customerSession.token
    );

    await cek(
      apiContract,
      'GET',
      '/api/me',
      denganToken,
      200
    );

  }
);


// ==================================================
// 3. PRODUK DAN PAGINATION
// ==================================================

test(
  'API produk mengembalikan daftar, pagination, dan 404 untuk produk tidak ditemukan',
  async ({ api, apiContract }) => {

    // Mengambil semua produk.
    const semuaProduk = await api.getProducts();

    await cek(
      apiContract,
      'GET',
      '/api/products',
      semuaProduk,
      200
    );

    const semuaBody = await semuaProduk.json();

    expect(Array.isArray(semuaBody.data)).toBe(true);

    // Mengambil halaman pertama, maksimal 3 produk.
    const halamanProduk = await api.getProducts({
      page: 1,
      limit: 3
    });

    await cek(
      apiContract,
      'GET',
      '/api/products',
      halamanProduk,
      200
    );

    const halamanBody = await halamanProduk.json();

    expect(Array.isArray(halamanBody.data)).toBe(true);

    expect(
      halamanBody.data.length
    ).toBeLessThanOrEqual(3);

    // Mencari ID produk yang tidak tersedia.
    const produkTidakAda = await api.getProduct(99);

    await cek(
      apiContract,
      'GET',
      '/api/products/{id}',
      produkTidakAda,
      404
    );

  }
);


// ==================================================
// 4. KERANJANG
// ==================================================

test(
  'API keranjang dapat menambahkan produk dan mengubah jumlahnya',
  async ({ api, apiContract, customerSession }) => {

    // Menambahkan satu Mouse Wireless.
    const tambah = await api.addToCart(
      customerSession.token,
      {
        productId: 2,
        qty: 1
      }
    );

    await cek(
      apiContract,
      'POST',
      '/api/cart',
      tambah,
      201
    );

    // Mengubah jumlahnya menjadi dua.
    const ubah = await api.updateCartItem(
      customerSession.token,
      2,
      {
        qty: 2
      }
    );

    await cek(
      apiContract,
      'PATCH',
      '/api/cart/{productId}',
      ubah,
      200
    );

    // Membaca kembali keranjang.
    const cart = await api.getCart(
      customerSession.token
    );

    await cek(
      apiContract,
      'GET',
      '/api/cart',
      cart,
      200
    );

    const cartBody = await cart.json() as {
      items?: Array<{
        productId?: number;
        qty?: number;
      }>;
    };

    const mouse = cartBody.items?.find(
      item => item.productId === 2
    );

    expect(mouse).toBeDefined();
    expect(mouse?.qty).toBe(2);

  }
);


// ==================================================
// 5. VALIDASI ALAMAT
// ==================================================

test(
  'API menolak alamat pengiriman dengan field wajib yang kosong',
  async ({ api, apiContract, customerSession }) => {

    const response = await api.createAddress(
      customerSession.token,
      {
        label: 'Rumah'
      }
    );

    await cek(
      apiContract,
      'POST',
      '/api/addresses',
      response,
      422
    );

    const body = await response.json();

    expect(body).toHaveProperty('fields');
    expect(body.fields).toBeTruthy();

    expect(
      Object.keys(body.fields).length
    ).toBeGreaterThan(0);

  }
);


// ==================================================
// 6. MEMBUAT DAN MEMBACA ALAMAT
// ==================================================

test(
  'API dapat membuat dan membaca alamat pengiriman milik customer',
  async ({ api, apiContract, customerSession }) => {

    const dataAlamat = buatAlamat();

    let addressId: string | number | undefined;

    try {

      // CREATE alamat.
      const create = await api.createAddress(
        customerSession.token,
        dataAlamat
      );

      await cek(
        apiContract,
        'POST',
        '/api/addresses',
        create,
        201
      );

      const createBody = await create.json() as {
        id?: string | number;
      };

      expect(createBody.id).toBeDefined();

      addressId = createBody.id;

      if (addressId === undefined) {
        throw new Error(
          'ID alamat tidak ditemukan.'
        );
      }

      // READ alamat yang baru dibuat.
      const detail = await api.getAddress(
        customerSession.token,
        addressId
      );

      await cek(
        apiContract,
        'GET',
        '/api/addresses/{id}',
        detail,
        200
      );

      const detailBody = await detail.json();

      expect(detailBody.id).toBe(addressId);
      expect(detailBody.city).toBe(dataAlamat.city);

    } finally {

      // Hapus data yang dibuat oleh test ini.
      if (addressId !== undefined) {

        const hapus = await api.deleteAddress(
          customerSession.token,
          addressId
        );

        expect(hapus.status()).toBe(204);

      }

    }

  }
);


// ==================================================
// 7. REVIEW PRODUK
// ==================================================

test(
  'API review produk dapat dibaca publik tetapi customer tanpa pembelian ditolak',
  async ({ api, apiContract, customerSession }) => {

    // Membaca review produk.
    const reviews = await api.getProductReviews(2);

    await cek(
      apiContract,
      'GET',
      '/api/products/{id}/reviews',
      reviews,
      200
    );

    // Customer belum pernah membeli produk 2.
    const createReview = await api.createProductReview(
      customerSession.token,
      2,
      {
        rating: 5,
        comment: 'Test review tanpa pembelian'
      }
    );

    await cek(
      apiContract,
      'POST',
      '/api/products/{id}/reviews',
      createReview,
      403
    );

  }
);


// ==================================================
// 8. ORDER KERANJANG KOSONG
// ==================================================

test(
  'API menolak pembuatan pesanan ketika keranjang kosong',
  async ({ api, apiContract, customerSession }) => {

    // Sesi customer baru dan tidak menambahkan produk.
    const response = await api.createOrder(
      customerSession.token,
      {
        name: 'QA Test',
        address: 'Alamat Testing'
      }
    );

    await cek(
      apiContract,
      'POST',
      '/api/orders',
      response,
      400
    );

  }
);


// ==================================================
// 9. ORDER DAN HAK AKSES ADMIN
// ==================================================

test(
  'Admin tidak dapat memproses kembali pesanan yang sudah dibatalkan',
  async ({
    api,
    apiContract,
    customerSession,
    adminSession
  }) => {

    const alamatData = buatAlamat();

    let addressId: string | number | undefined;

    let orderId: string | undefined;

    let sudahDibatalkan = false;

    try {

      // Siapkan keranjang customer.
      const tambahCart = await api.addToCart(
        customerSession.token,
        {
          productId: 2,
          qty: 1
        }
      );

      await cek(
        apiContract,
        'POST',
        '/api/cart',
        tambahCart,
        201
      );

      // Buat alamat yang diperlukan untuk pesanan.
      const buatAlamatResponse = await api.createAddress(
        customerSession.token,
        alamatData
      );

      await cek(
        apiContract,
        'POST',
        '/api/addresses',
        buatAlamatResponse,
        201
      );

      const alamatBody = await buatAlamatResponse.json() as {
        id?: string | number;
      };

      expect(alamatBody.id).toBeDefined();

      addressId = alamatBody.id;

      if (addressId === undefined) {
        throw new Error('ID alamat tidak ditemukan.');
      }

      // Buat pesanan.
      const buatPesanan = await api.createOrder(
        customerSession.token,
        {
          addressId,
          shipping: 'express',
          payment: 'ewallet'
        }
      );

      await cek(
        apiContract,
        'POST',
        '/api/orders',
        buatPesanan,
        201
      );

      const orderBody = await buatPesanan.json() as {
        id?: string;
      };

      expect(orderBody.id).toBeDefined();

      if (!orderBody.id) {
        throw new Error('ID pesanan tidak ditemukan.');
      }

      orderId = orderBody.id;

      // Memastikan server memberikan header Location.
      expect(
        buatPesanan.headers()['location']
      ).toBeTruthy();

      // Membatalkan pesanan.
      const cancel = await api.cancelOrder(
        customerSession.token,
        orderId,
        {
          reason: 'Salah pilih'
        }
      );

      await cek(
        apiContract,
        'POST',
        '/api/orders/{id}/cancel',
        cancel,
        200
      );

      sudahDibatalkan = true;

      // Admin mencoba membaca detail pesanan.
      const adminDetail = await api.getAdminOrder(
        adminSession.token,
        orderId
      );

      await cek(
        apiContract,
        'GET',
        '/api/admin/orders/{id}',
        adminDetail,
        200
      );

      // Admin mencoba memproses pesanan yang sudah dibatalkan.
      const updateStatus = await api.updateAdminOrder(
        adminSession.token,
        orderId,
        {
          status: 'Diproses'
        }
      );

      await cek(
        apiContract,
        'PATCH',
        '/api/admin/orders/{id}',
        updateStatus,
        409
      );

    } finally {

      // Jika proses test terhenti sebelum pembatalan,
      // coba batalkan pesanan yang sudah terlanjur dibuat.
      if (orderId && !sudahDibatalkan) {

        await api.cancelOrder(
          customerSession.token,
          orderId,
          {
            reason: 'Pembersihan data test'
          }
        );

      }

      // Hapus alamat sementara milik test ini.
      if (addressId !== undefined) {

        await api.deleteAddress(
          customerSession.token,
          addressId
        );

      }

    }

  }
);


// ==================================================
// 10. CUSTOMER TIDAK BOLEH MASUK ADMIN
// ==================================================

test(
  'Customer tidak memiliki izin mengakses daftar pesanan admin',
  async ({ api, apiContract, customerSession }) => {

    const response = await api.getAdminOrders(
      customerSession.token
    );

    await cek(
      apiContract,
      'GET',
      '/api/admin/orders',
      response,
      403
    );

  }
);


// ==================================================
// 11. ADMIN CRUD KUPON
// ==================================================

test(
  'Admin dapat membuat melihat dan menghapus kupon',
  async ({ api, apiContract, adminSession }) => {

    const code =
      `UJI${randomUUID()
        .replace(/-/g, '')
        .slice(0, 6)
        .toUpperCase()}`;

    let couponBerhasilDibuat = false;

    try {

      // CREATE kupon.
      const create = await api.createAdminCoupon(
        adminSession.token,
        {
          code,
          type: 'percent',
          value: 15
        }
      );

      // Tandai sebelum validasi schema agar data tetap
      // dibersihkan meskipun contract assertion gagal.
      couponBerhasilDibuat =
        create.status() === 201;

      await cek(
        apiContract,
        'POST',
        '/api/admin/coupons',
        create,
        201
      );

      // READ daftar kupon.
      const list = await api.getAdminCoupons(
        adminSession.token
      );

      await cek(
        apiContract,
        'GET',
        '/api/admin/coupons',
        list,
        200
      );

      const listBody = await list.json() as
        | Array<{ code?: string }>
        | { data?: Array<{ code?: string }> };

      const coupons = Array.isArray(listBody)
        ? listBody
        : listBody.data ?? [];

      expect(
        coupons.some(item => item.code === code)
      ).toBe(true);

    } finally {

      // DELETE kupon sementara.
      if (couponBerhasilDibuat) {

        const remove = await api.deleteAdminCoupon(
          adminSession.token,
          code
        );

        expect(remove.status()).toBe(204);

      }

    }

  }
);


// ==================================================
// 12. KUPON BAWAAN
// ==================================================

test(
  'Admin tidak dapat mengubah kupon bawaan HEMAT10',
  async ({ api, apiContract, adminSession }) => {

    const response = await api.updateAdminCoupon(
      adminSession.token,
      'HEMAT10',
      {
        value: 50
      }
    );

    await cek(
      apiContract,
      'PATCH',
      '/api/admin/coupons/{code}',
      response,
      409
    );

  }
);


// ==================================================
// 13. DAFTAR ADMIN
// ==================================================

test(
  'Admin dapat membaca daftar pesanan dan katalog produk',
  async ({ api, apiContract, adminSession }) => {

    // Daftar pesanan dengan pagination.
    const orders = await api.getAdminOrders(
      adminSession.token,
      {
        page: 1,
        limit: 5
      }
    );

    await cek(
      apiContract,
      'GET',
      '/api/admin/orders',
      orders,
      200
    );

    // Daftar produk admin.
    const products = await api.getAdminProducts(
      adminSession.token
    );

    await cek(
      apiContract,
      'GET',
      '/api/admin/products',
      products,
      200
    );

  }
);


// ==================================================
// 14. RESTOCK PRODUK TERKUNCI
// ==================================================

test(
  'Admin tidak dapat menambah stok produk yang dikunci',
  async ({ api, apiContract, adminSession }) => {

    const response = await api.restockAdminProduct(
      adminSession.token,
      8,
      {
        qty: 5
      }
    );

    await cek(
      apiContract,
      'POST',
      '/api/admin/products/{id}/restock',
      response,
      409
    );

  }
);
