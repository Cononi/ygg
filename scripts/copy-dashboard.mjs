import { cp, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const src = join(__dir, '..', 'packages', 'dashboard', 'dist')
const dest = join(__dir, '..', 'dist', 'dashboard')

await mkdir(dest, { recursive: true })
await cp(src, dest, { recursive: true })
console.log('✓ Copied dashboard to dist/dashboard/')
