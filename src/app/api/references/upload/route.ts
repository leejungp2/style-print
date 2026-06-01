import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { promises as fs } from 'fs'
import path from 'path'
import { getReference, saveReference } from '@/lib/db'
import type { ReferenceAsset, UploadResponse } from '@/lib/types'

// 최대 파일 크기: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// 허용되는 MIME 타입
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp']
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function validateBase64Image(dataUrl: string): {
  valid: boolean
  mime?: string
  buffer?: Buffer
  error?: string
} {
  // data:image/png;base64,xxxxx 형식 파싱
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/i)
  if (!match) {
    return { valid: false, error: 'Invalid data URL format' }
  }

  const mime = match[1].toLowerCase()
  const data = match[2]

  if (!ALLOWED_MIMES.includes(mime)) {
    return {
      valid: false,
      error: `Unsupported image type: ${mime}. Allowed: ${ALLOWED_MIMES.join(', ')}`,
    }
  }

  // Base64 크기 계산 (대략적)
  const sizeBytes = (data.length * 3) / 4
  if (sizeBytes > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  try {
    return { valid: true, mime, buffer: Buffer.from(data, 'base64') }
  } catch {
    return { valid: false, error: 'Invalid base64 image data' }
  }
}

// Base64에서 이미지 크기 추출 (간단한 구현, 실제로는 더 정교한 파싱 필요)
function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  // 서버에서는 이미지 파싱이 복잡하므로 일단 기본값 반환
  // 실제 구현에서는 sharp 같은 라이브러리 사용 권장
  return Promise.resolve({ width: 0, height: 0 })
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

async function deleteStoredReferenceFile(reference: ReferenceAsset) {
  const relativePath =
    reference.storagePath ||
    (reference.url?.startsWith('/uploads/')
      ? `public${reference.url}`
      : undefined)

  if (!relativePath || !relativePath.startsWith('public/uploads/')) {
    return
  }

  try {
    await fs.unlink(path.join(process.cwd(), relativePath))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const body = await request.json()
    const { files } = body as { files: string[] }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, references: [], error: 'No files provided' },
        { status: 400 }
      )
    }

    const references: ReferenceAsset[] = []
    await ensureUploadDir()

    for (let i = 0; i < files.length; i++) {
      const dataUrl = files[i]
      const validation = validateBase64Image(dataUrl)

      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            references: [],
            error: `File ${i + 1}: ${validation.error}`,
          },
          { status: 400 }
        )
      }

      const dimensions = await getImageDimensions(dataUrl)
      const id = nanoid()
      const extension = MIME_EXTENSIONS[validation.mime!]
      const filename = `reference-${Date.now()}-${i}-${id}.${extension}`
      const storagePath = `public/uploads/${filename}`
      const url = `/uploads/${filename}`

      await fs.writeFile(path.join(UPLOAD_DIR, filename), validation.buffer!)

      const reference: ReferenceAsset = {
        id,
        filename,
        mime: validation.mime!,
        width: dimensions.width,
        height: dimensions.height,
        url,
        storagePath,
        createdAt: Date.now(),
      }

      await saveReference(reference)
      references.push(reference)
    }

    return NextResponse.json({
      success: true,
      references,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        success: false,
        references: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  const { getReferences } = await import('@/lib/db')
  const references = await getReferences()
  return NextResponse.json({ success: true, references })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'No id provided' },
        { status: 400 }
      )
    }

    const { deleteReference } = await import('@/lib/db')
    const reference = await getReference(id)
    if (reference) {
      await deleteStoredReferenceFile(reference)
    }
    await deleteReference(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
