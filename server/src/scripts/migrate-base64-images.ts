import path from 'path'
import dotenv from 'dotenv'
import { Logger } from '@nestjs/common'
import { getPool } from '../storage/database/mysql-client'
import { StorageService } from '../modules/storage/storage.service'

type Row = {
  id: string
  order_id: string | null
  images: string | null
}

function parseImagesField(images: string | null): string[] | null {
  if (!images) return null

  const tryParse = (input: string): unknown => {
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  const parsed = tryParse(images)
  if (Array.isArray(parsed)) {
    const list = parsed.filter((v) => typeof v === 'string') as string[]
    return list.length ? list : null
  }

  if (typeof parsed === 'string') {
    return parsed ? [parsed] : null
  }

  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).images)) {
    const list = (parsed as any).images.filter((v: unknown) => typeof v === 'string') as string[]
    return list.length ? list : null
  }

  return null
}

function estimateBase64Bytes(dataUrl: string): number {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  return Math.floor((base64.length * 3) / 4)
}

function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx < 0) return
  return process.argv[idx + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

async function main() {
  Logger.overrideLogger(false)

  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server/.env'),
    path.resolve(__dirname, '../../../.env'),
  ]

  for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath })
    if (!result.error) break
  }

  const batchSize = Number(getArgValue('--batch') || '20')
  const maxBatches = Number(getArgValue('--max-batches') || '1000')
  const dryRun = hasFlag('--dry-run')
  const maxImageBytes = Number(getArgValue('--max-image-bytes') || String(8 * 1024 * 1024))

  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error('invalid --batch')
  }
  if (!Number.isFinite(maxBatches) || maxBatches <= 0) {
    throw new Error('invalid --max-batches')
  }
  if (!Number.isFinite(maxImageBytes) || maxImageBytes <= 0) {
    throw new Error('invalid --max-image-bytes')
  }

  const pool = getPool()
  const storageService = new StorageService()

  let totalRows = 0
  let totalImages = 0
  let totalUpdated = 0

  for (let batch = 0; batch < maxBatches; batch++) {
    const [rows] = await pool.query<any[]>(
      'SELECT id, order_id, images FROM content_generation_requests WHERE images IS NOT NULL AND images LIKE ? ORDER BY created_at ASC, id ASC LIMIT ?',
      ['%data:image/%', batchSize]
    )

    if (!rows.length) break

    for (const row of rows as Row[]) {
      totalRows += 1

      const parsedImages = parseImagesField(row.images)
      if (!parsedImages) continue

      const images = parsedImages.slice()
      let changed = false
      let rowBase64Count = 0
      let rowIndex = 0

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (typeof img !== 'string') continue
        if (!img.startsWith('data:image/')) continue
        if (estimateBase64Bytes(img) > maxImageBytes) {
          console.log(JSON.stringify({ id: row.id, skipped: 'too_large', index: i + 1 }))
          continue
        }

        totalImages += 1
        rowBase64Count += 1
        const fileName = `content-images_${row.id}_${i + 1}.png`
        if (!dryRun) {
          if (rowIndex === 0) {
            console.log(JSON.stringify({ id: row.id, action: 'migrating' }))
          }
          rowIndex += 1
          const url = await storageService.uploadBase64Image(img, fileName)
          images[i] = url
        }
        changed = true
      }

      if (!changed) continue

      totalUpdated += 1

      if (dryRun) {
        continue
      }

      await pool.query('UPDATE content_generation_requests SET images = ? WHERE id = ?', [
        JSON.stringify(images),
        row.id,
      ])

      if (rowBase64Count > 0) {
        console.log(JSON.stringify({ id: row.id, updatedBase64Count: rowBase64Count }))
      }
    }
  }

  await pool.end()

  console.log(
    JSON.stringify(
      {
        dryRun,
        batchSize,
        maxBatches,
        totalRows,
        totalImages,
        totalUpdated,
      },
      null,
      2
    )
  )

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
