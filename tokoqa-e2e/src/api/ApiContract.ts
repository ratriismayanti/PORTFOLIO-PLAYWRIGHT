
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

import type {
  AnySchema,
  ValidateFunction
} from 'ajv';

import type {
  APIRequestContext,
  APIResponse
} from '@playwright/test';

// Bentuk sederhana dokumen OpenAPI yang kita perlukan.
type OpenApiDocument = {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: {
    schemas?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

// Mengecek apakah sebuah nilai berbentuk object.
function isObject(
  value: unknown
): value is Record<string, unknown> {

  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Mengambil data berdasarkan alamat JSON Pointer.
function ambilPointer(
  document: OpenApiDocument,
  reference: string
): unknown {

  if (!reference.startsWith('#/')) {
    throw new Error(
      `Referensi OpenAPI tidak didukung: ${reference}`
    );
  }

  const parts = reference
    .slice(2)
    .split('/')
    .map(part =>
      part.replace(/~1/g, '/').replace(/~0/g, '~')
    );

  let current: unknown = document;

  for (const part of parts) {

    if (
      !isObject(current) ||
      !(part in current)
    ) {
      throw new Error(
        `Referensi OpenAPI tidak ditemukan: ${reference}`
      );
    }

    current = current[part];
  }

  return current;
}

// Membaca $ref lokal pada Response Object atau Header Object.
function selesaikanRef(
  value: unknown,
  document: OpenApiDocument
): Record<string, unknown> {

  if (!isObject(value)) {
    throw new Error('Objek OpenAPI tidak valid.');
  }

  let current = value;
  const visited = new Set<string>();

  while (typeof current.$ref === 'string') {

    const reference = current.$ref;

    if (visited.has(reference)) {
      throw new Error(
        `Referensi OpenAPI melingkar: ${reference}`
      );
    }

    visited.add(reference);

    const target = ambilPointer(
      document,
      reference
    );

    if (!isObject(target)) {
      throw new Error(
        `Target referensi bukan object: ${reference}`
      );
    }

    const siblings = Object.fromEntries(
      Object.entries(current).filter(
        ([key]) => key !== '$ref'
      )
    );

    current = {
      ...target,
      ...siblings
    };
  }

  return current;
}

// Mengubah referensi OpenAPI menjadi referensi $defs AJV.
// Juga menangani nullable milik OpenAPI 3.0.
function normalisasiSchema(value: unknown): unknown {

  if (Array.isArray(value)) {
    return value.map(item =>
      normalisasiSchema(item)
    );
  }

  if (!isObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {

    if (key === 'nullable') {
      continue;
    }

    result[key] = normalisasiSchema(item);
  }

  if (typeof result.$ref === 'string') {

    const reference = result.$ref;

    if (
      reference.startsWith(
        '#/components/schemas/'
      )
    ) {

      result.$ref = reference.replace(
        '#/components/schemas/',
        '#/$defs/'
      );

    } else if (
      !reference.startsWith('#/$defs/') &&
      !reference.startsWith('#/definitions/')
    ) {

      throw new Error(
        `Schema reference belum didukung: ${reference}`
      );
    }
  }

  // OpenAPI 3.0 nullable: true berarti nilai boleh null.
  if (value.nullable === true) {

    if (Array.isArray(result.type)) {

      if (!result.type.includes('null')) {
        result.type = [...result.type, 'null'];
      }

      return result;
    }

    return {
      anyOf: [
        result,
        { type: 'null' }
      ]
    };
  }

  return result;
}

// Mencocokkan Content-Type aktual dengan yang ada di Spec.
function cocokMediaType(
  declared: string,
  actual: string
): boolean {

  const expected = declared.toLowerCase();

  if (expected === '*/*' || expected === actual) {
    return true;
  }

  const [expectedMain, expectedSub] =
    expected.split('/');

  const [actualMain, actualSub] =
    actual.split('/');

  if (
    expectedMain !== '*' &&
    expectedMain !== actualMain
  ) {
    return false;
  }

  if (expectedSub === '*') {
    return true;
  }

  if (expectedSub?.startsWith('*+')) {

    const suffix = expectedSub.slice(1);

    return actualSub?.endsWith(suffix) ?? false;
  }

  return false;
}

function mediaTypeJson(mediaType: string): boolean {

  return (
    mediaType === 'application/json' ||
    mediaType.endsWith('/json') ||
    mediaType.endsWith('+json')
  );
}

// Memeriksa tipe sederhana untuk nilai header HTTP.
function tipeHeader(
  schema: unknown,
  document: OpenApiDocument
): unknown {

  let current = schema;

  while (
    isObject(current) &&
    typeof current.$ref === 'string'
  ) {

    current = ambilPointer(
      document,
      current.$ref
    );
  }

  return isObject(current) ? current.type : undefined;
}

export class ApiContract {

  private readonly ajv: Ajv2020;

  private readonly cache =
    new Map<string, ValidateFunction>();

  constructor(
    private readonly document: OpenApiDocument
  ) {

    this.ajv = new Ajv2020({
      allErrors: true,
      strict: false
    });

    addFormats(this.ajv);
  }

  // Membuat validator berdasarkan schema dari OpenAPI.
  private buatValidator(
    schema: unknown,
    cacheKey: string
  ): ValidateFunction {

    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const converted = normalisasiSchema(schema);

    const localSchema = isObject(converted)
      ? { ...converted }
      : {};

    const localDefs = isObject(localSchema.$defs)
      ? localSchema.$defs
      : {};

    delete localSchema.$id;
    delete localSchema.$schema;
    delete localSchema.$defs;

    const componentSchemas =
      this.document.components?.schemas ?? {};

    const definitions = Object.fromEntries(
      Object.entries(componentSchemas).map(
        ([name, definition]) => [
          name,
          normalisasiSchema(definition)
        ]
      )
    );

    const finalSchema = {
      $schema:
        'https://json-schema.org/draft/2020-12/schema',

      $id:
        `https://tokoqa.invalid/${encodeURIComponent(cacheKey)}`,

      $defs: {
        ...definitions,
        ...localDefs
      },

      allOf: [converted]
    };

    const validator = this.ajv.compile(
      finalSchema as AnySchema
    );

    this.cache.set(cacheKey, validator);

    return validator;
  }

  // Membandingkan data aktual dengan schema.
  private validasiSchema(
    schema: unknown,
    actualData: unknown,
    description: string
  ): void {

    const validator = this.buatValidator(
      schema,
      description
    );

    if (!validator(actualData)) {

      const errors = this.ajv.errorsText(
        validator.errors,
        { separator: '\n' }
      );

      throw new Error(
        `${description} tidak sesuai OpenAPI Spec:\n${errors}`
      );
    }
  }

  // Mencari aturan respons berdasarkan method, path, dan status.
  private cariResponse(
    method: string,
    path: string,
    status: number
  ): Record<string, unknown> {

    const pathItem = this.document.paths?.[path];

    const operation = pathItem?.[method.toLowerCase()];

    if (!isObject(operation)) {
      throw new Error(
        `Endpoint ${method.toUpperCase()} ${path} tidak ditemukan di OpenAPI Spec.`
      );
    }

    if (!isObject(operation.responses)) {
      throw new Error(
        `Response belum didefinisikan untuk ${method.toUpperCase()} ${path}.`
      );
    }

    const responses = operation.responses;

    const statusGroup =
      `${Math.floor(status / 100)}XX`;

    const response =
      responses[String(status)] ??
      responses[statusGroup] ??
      responses.default;

    if (!response) {
      throw new Error(
        `HTTP ${status} tidak didokumentasikan untuk ${method.toUpperCase()} ${path}.`
      );
    }

    return selesaikanRef(
      response,
      this.document
    );
  }

  // Fungsi utama untuk memeriksa respons API.
  async cek(
    method: string,
    path: string,
    response: APIResponse
  ): Promise<void> {

    const status = response.status();

    const responseSpec = this.cariResponse(
      method,
      path,
      status
    );

    const actualHeaders = response.headers();

    // ----------------------------------------------
    // 1. Periksa header response.
    // ----------------------------------------------

    const declaredHeaders = isObject(responseSpec.headers)
      ? responseSpec.headers
      : {};

    for (
      const [headerName, rawHeaderSpec]
      of Object.entries(declaredHeaders)
    ) {

      const headerSpec = selesaikanRef(
        rawHeaderSpec,
        this.document
      );

      const actualValue =
        actualHeaders[headerName.toLowerCase()];

      // Header hanya wajib jika Spec menyatakan required: true.
      if (actualValue === undefined) {

        if (headerSpec.required === true) {
          throw new Error(
            `Header wajib ${headerName} tidak ditemukan.`
          );
        }

        continue;
      }

      if (headerSpec.schema !== undefined) {

        const type = tipeHeader(
          headerSpec.schema,
          this.document
        );

        let parsedValue: unknown = actualValue;

        if (
          type === 'integer' &&
          /^-?\d+$/.test(actualValue)
        ) {
          parsedValue = Number(actualValue);
        }

        if (
          type === 'number' &&
          actualValue.trim() !== '' &&
          !Number.isNaN(Number(actualValue))
        ) {
          parsedValue = Number(actualValue);
        }

        if (
          type === 'boolean' &&
          ['true', 'false'].includes(actualValue)
        ) {
          parsedValue = actualValue === 'true';
        }

        this.validasiSchema(
          headerSpec.schema,
          parsedValue,
          `Header ${headerName}`
        );
      }
    }

    // ----------------------------------------------
    // 2. Periksa response body dan Content-Type.
    // ----------------------------------------------

    const declaredContent = isObject(responseSpec.content)
      ? responseSpec.content
      : {};

    const bodyBuffer = await response.body();

    // Misalnya HTTP 204: tidak ada body yang diharapkan.
    if (Object.keys(declaredContent).length === 0) {

      if (bodyBuffer.length > 0) {
        throw new Error(
          `Respons ${method.toUpperCase()} ${path} memiliki body, tetapi Spec tidak mendefinisikannya.`
        );
      }

      return;
    }

    if (bodyBuffer.length === 0) {

      const schemaExpected = Object.values(
        declaredContent
      ).some(
        item =>
          isObject(item) &&
          item.schema !== undefined
      );

      if (schemaExpected) {
        throw new Error(
          `Body respons ${method.toUpperCase()} ${path} kosong, padahal Spec menyediakan schema.`
        );
      }

      return;
    }

    const rawContentType =
      actualHeaders['content-type'];

    if (!rawContentType) {
      throw new Error(
        `Content-Type tidak ditemukan pada respons ${method.toUpperCase()} ${path}.`
      );
    }

    const actualContentType =
      rawContentType
        .split(';')[0]
        .trim()
        .toLowerCase();

    const matchedContent = Object.entries(
      declaredContent
    ).find(
      ([declaredType]) =>
        cocokMediaType(
          declaredType,
          actualContentType
        )
    );

    if (!matchedContent) {
      throw new Error(
        `Content-Type ${actualContentType} tidak sesuai OpenAPI Spec.`
      );
    }

    const [declaredType, mediaSpec] =
      matchedContent;

    if (!isObject(mediaSpec) || mediaSpec.schema === undefined) {
      return;
    }

    // ----------------------------------------------
    // 3. Periksa isi body.
    // ----------------------------------------------

    let responseBody: unknown;

    if (mediaTypeJson(actualContentType)) {

      try {
        responseBody = await response.json();
      } catch {
        throw new Error(
          `Response ${method.toUpperCase()} ${path} seharusnya JSON, tetapi tidak bisa dibaca sebagai JSON.`
        );
      }

    } else {

      responseBody = await response.text();

    }

    const cacheKey =
      `${method.toUpperCase()}-${path}-${status}-${declaredType}`;

    this.validasiSchema(
      mediaSpec.schema,
      responseBody,
      cacheKey
    );
  }
}

// Mengambil OpenAPI Spec dari server.
export async function muatKontrak(
  request: APIRequestContext,
  nama: string
): Promise<ApiContract> {

  const specPath =
    `/spec/${encodeURIComponent(nama)}.json`;

  const response = await request.get(specPath);

  if (!response.ok()) {
    throw new Error(
      `OpenAPI Spec gagal dimuat dari ${specPath}. HTTP ${response.status()}.`
    );
  }

  const document =
    await response.json() as OpenApiDocument;

  if (
    !document ||
    typeof document.openapi !== 'string' ||
    !isObject(document.paths)
  ) {
    throw new Error(
      `File ${specPath} bukan dokumen OpenAPI yang valid.`
    );
  }

  return new ApiContract(document);
}
