export function wajibEnv(nama: string): string {
  const nilai = process.env[nama];

  if (!nilai || !nilai.trim()) {
    throw new Error(
      `Environment variable ${nama} belum diisi. Periksa file .env.`
    );
  }

  return nilai;
}