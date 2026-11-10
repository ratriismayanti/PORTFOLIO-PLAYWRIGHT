
import type {
  APIRequestContext,
  APIResponse
} from '@playwright/test';

// Bentuk umum data yang dikirim ke API.
export type JsonBody = Record<string, unknown>;

// Bentuk parameter URL, misalnya ?page=1&limit=3.
export type QueryParams = Record<
  string,
  string | number | boolean
>;

// Informasi sesi setelah login berhasil.
export type ApiSession = {
  token: string;
  headers: {
    Authorization: string;
  };
};

export class TokoQAApi {

  // Menyimpan alat untuk mengirim request API.
  constructor(
    private readonly request: APIRequestContext
  ) {}

  // Membuat header untuk API yang membutuhkan login.
  private auth(token: string): { Authorization: string } {
    if (!token.trim()) {
      throw new Error('Token tidak boleh kosong.');
    }

    return {
      Authorization: `Bearer ${token}`
    };
  }

  // ==================================================
  // LOGIN DAN PROFIL
  // ==================================================

  // Login. Mengembalikan respons asli agar bisa diuji.
  login(
    username: string,
    password: string,
    extra: JsonBody = {}
  ): Promise<APIResponse> {

    return this.request.post('/api/login', {
      data: {
        username,
        password,
        ...extra
      }
    });
  }

  // Login sekaligus mengambil token.
  // Digunakan untuk menyiapkan sesi customer/admin.
  async loginSession(
    username: string,
    password: string,
    extra: JsonBody = {}
  ): Promise<ApiSession> {

    const response = await this.login(
      username,
      password,
      extra
    );

    if (!response.ok()) {
      throw new Error(
        `Login API gagal. HTTP ${response.status()}.`
      );
    }

    const body = await response.json() as {
      token?: unknown;
    };

    if (
      typeof body.token !== 'string' ||
      !body.token.trim()
    ) {
      throw new Error(
        'Respons login tidak memiliki token yang valid.'
      );
    }

    return {
      token: body.token,
      headers: this.auth(body.token)
    };
  }

  getMe(token?: string): Promise<APIResponse> {

    if (!token) {
      return this.request.get('/api/me');
    }

    return this.request.get('/api/me', {
      headers: this.auth(token)
    });
  }

  // ==================================================
  // PRODUK
  // ==================================================

  getProducts(
    params?: QueryParams
  ): Promise<APIResponse> {

    return this.request.get('/api/products', {
      ...(params ? { params } : {})
    });
  }

  getProduct(
    productId: string | number
  ): Promise<APIResponse> {

    return this.request.get(
      `/api/products/${encodeURIComponent(String(productId))}`
    );
  }

  // ==================================================
  // KERANJANG
  // ==================================================

  getCart(token: string): Promise<APIResponse> {

    return this.request.get('/api/cart', {
      headers: this.auth(token)
    });
  }

  addToCart(
    token: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post('/api/cart', {
      headers: this.auth(token),
      data
    });
  }

  updateCartItem(
    token: string,
    productId: string | number,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.patch(
      `/api/cart/${encodeURIComponent(String(productId))}`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  // ==================================================
  // ALAMAT PENGIRIMAN
  // ==================================================

  getAddresses(token: string): Promise<APIResponse> {

    return this.request.get('/api/addresses', {
      headers: this.auth(token)
    });
  }

  createAddress(
    token: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post('/api/addresses', {
      headers: this.auth(token),
      data
    });
  }

  getAddress(
    token: string,
    addressId: string | number
  ): Promise<APIResponse> {

    return this.request.get(
      `/api/addresses/${encodeURIComponent(String(addressId))}`,
      {
        headers: this.auth(token)
      }
    );
  }

  replaceAddress(
    token: string,
    addressId: string | number,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.put(
      `/api/addresses/${encodeURIComponent(String(addressId))}`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  updateAddress(
    token: string,
    addressId: string | number,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.patch(
      `/api/addresses/${encodeURIComponent(String(addressId))}`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  deleteAddress(
    token: string,
    addressId: string | number
  ): Promise<APIResponse> {

    return this.request.delete(
      `/api/addresses/${encodeURIComponent(String(addressId))}`,
      {
        headers: this.auth(token)
      }
    );
  }

  // ==================================================
  // PESANAN
  // ==================================================

  createOrder(
    token: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post('/api/orders', {
      headers: this.auth(token),
      data
    });
  }

  getOrders(
    token: string,
    params?: QueryParams
  ): Promise<APIResponse> {

    return this.request.get('/api/orders', {
      headers: this.auth(token),
      ...(params ? { params } : {})
    });
  }

  getOrder(
    token: string,
    orderId: string
  ): Promise<APIResponse> {

    return this.request.get(
      `/api/orders/${encodeURIComponent(orderId)}`,
      {
        headers: this.auth(token)
      }
    );
  }

  cancelOrder(
    token: string,
    orderId: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post(
      `/api/orders/${encodeURIComponent(orderId)}/cancel`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  // ==================================================
  // KUPON CUSTOMER
  // ==================================================

  applyCoupon(
    token: string,
    code: string
  ): Promise<APIResponse> {

    return this.request.post('/api/coupons/apply', {
      headers: this.auth(token),
      data: { code }
    });
  }

  // ==================================================
  // REVIEW PRODUK
  // ==================================================

  getProductReviews(
    productId: string | number
  ): Promise<APIResponse> {

    return this.request.get(
      `/api/products/${encodeURIComponent(String(productId))}/reviews`
    );
  }

  createProductReview(
    token: string,
    productId: string | number,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post(
      `/api/products/${encodeURIComponent(String(productId))}/reviews`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  // ==================================================
  // ADMIN: KUPON
  // ==================================================

  createAdminCoupon(
    token: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post('/api/admin/coupons', {
      headers: this.auth(token),
      data
    });
  }

  getAdminCoupons(token: string): Promise<APIResponse> {

    return this.request.get('/api/admin/coupons', {
      headers: this.auth(token)
    });
  }

  updateAdminCoupon(
    token: string,
    code: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.patch(
      `/api/admin/coupons/${encodeURIComponent(code)}`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  deleteAdminCoupon(
    token: string,
    code: string
  ): Promise<APIResponse> {

    return this.request.delete(
      `/api/admin/coupons/${encodeURIComponent(code)}`,
      {
        headers: this.auth(token)
      }
    );
  }

  // ==================================================
  // ADMIN: PESANAN
  // ==================================================

  getAdminOrders(
    token: string,
    params?: QueryParams
  ): Promise<APIResponse> {

    return this.request.get('/api/admin/orders', {
      headers: this.auth(token),
      ...(params ? { params } : {})
    });
  }

  getAdminOrder(
    token: string,
    orderId: string
  ): Promise<APIResponse> {

    return this.request.get(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      {
        headers: this.auth(token)
      }
    );
  }

  updateAdminOrder(
    token: string,
    orderId: string,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.patch(
      `/api/admin/orders/${encodeURIComponent(orderId)}`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  // ==================================================
  // ADMIN: PRODUK
  // ==================================================

  getAdminProducts(token: string): Promise<APIResponse> {

    return this.request.get('/api/admin/products', {
      headers: this.auth(token)
    });
  }

  restockAdminProduct(
    token: string,
    productId: string | number,
    data: JsonBody
  ): Promise<APIResponse> {

    return this.request.post(
      `/api/admin/products/${encodeURIComponent(String(productId))}/restock`,
      {
        headers: this.auth(token),
        data
      }
    );
  }

  // ==================================================
  // TIMEOUT / RESPONSE TIME
  // ==================================================

  getSlowEndpoint(
    milliseconds: number,
    timeout = 5000
  ): Promise<APIResponse> {

    return this.request.get('/api/slow', {
      params: { ms: milliseconds },
      timeout
    });
  }
}
