// Cloudflare bindings are present only in the Cloudflare build. Vercel requests
// use the signed HTTP bridge and never execute the local Cloudflare handler.
export const env={} as Cloudflare.Env;
