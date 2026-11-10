
import {
  defineConfig,
  devices
} from '@playwright/test';

import dotenv from 'dotenv';
import path from 'path';

// Membaca file .env dari folder utama project.
dotenv.config({
  path: path.resolve(__dirname, '.env')
});

export default defineConfig({

  // Lokasi seluruh file pengujian.
  testDir: './tests',

  // Tidak menjalankan test secara paralel.
  fullyParallel: false,

  // Melarang test.only dan describe.only.
  forbidOnly: true,

  // Tidak menggunakan retry agar kegagalan terlihat.
  retries: 0,

  // Satu test berjalan pada satu waktu.
  workers: 1,

  // Batas waktu satu test.
  timeout: 30_000,

  // Batas waktu assertion.
  expect: {
    timeout: 5_000
  },

  // Laporan hasil test.
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never'
      }
    ]
  ],

  // Pengaturan umum.
  use: {

    baseURL:
      process.env.BASE_URL ||
      'http://localhost:3000',

    trace: 'retain-on-failure',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure'

  },

  projects: [

    // ============================================
    // API TESTING
    // ============================================

    {
      name: 'api',

      // Hanya menjalankan file di tests/api.
      testMatch: '**/api/**/*.spec.ts'
    },

    // ============================================
    // UI TESTING - CHROMIUM
    // ============================================

    {
      name: 'chromium',

      // Menjalankan E2E dan example.spec.ts di root tests.
      testMatch: [
        '**/e2e/**/*.spec.ts',
        '**/example.spec.ts'
      ],

      use: {
        ...devices['Desktop Chrome']
      }
    },

    // ============================================
    // UI TESTING - FIREFOX
    // ============================================

    {
      name: 'firefox',

      testMatch: [
        '**/e2e/**/*.spec.ts',
        '**/example.spec.ts'
      ],

      use: {
        ...devices['Desktop Firefox']
      }
    },

    // ============================================
    // UI TESTING - WEBKIT
    // ============================================

    {
      name: 'webkit',

      testMatch: [
        '**/e2e/**/*.spec.ts',
        '**/example.spec.ts'
      ],

      use: {
        ...devices['Desktop Safari']
      }
    }

  ]

});

