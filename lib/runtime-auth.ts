import { randomBytes } from "crypto"

// Ensure the boot secret is consistent across module reloads/process workers during a single boot
// We memoize on globalThis to avoid regenerating different secrets across route handlers
function getOrInitBootSecret(): string {
  const g = globalThis as any
  if (!g.__BOOT_SECRET) {
    g.__BOOT_SECRET = randomBytes(32).toString("hex")
  }
  return g.__BOOT_SECRET as string
}

export function getRuntimeJwtSecret(): Uint8Array {
  const base = process.env.JWT_SECRET_BASE || ""
  const bootSecret = getOrInitBootSecret()
  return new TextEncoder().encode(`${base}:${bootSecret}`)
}


