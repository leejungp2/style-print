import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { promises as fs } from 'fs'
import path from 'path'
import { getReference, saveFacetPack, getFacetPackByRefId } from '@/lib/db'
import {
  extractColorsFromBase64,
  assignColorRoles,
} from '@/lib/color-extractor'
import {
  extractTypography,
  extractLayout,
  extractMood,
} from '@/lib/v0-client'
import type {
  FacetPack,
  ExtractResponse,
  SpacingFacetToken,
  ComponentStyleFacetToken,
  ReferenceAsset,
} from '@/lib/types'

async function getReferenceImageDataUrl(
  reference: ReferenceAsset
): Promise<string | null> {
  if (reference.dataUrl) {
    return reference.dataUrl
  }

  const relativePath =
    reference.storagePath ||
    (reference.url?.startsWith('/uploads/')
      ? `public${reference.url}`
      : undefined)

  if (!relativePath || !relativePath.startsWith('public/uploads/')) {
    return null
  }

  const buffer = await fs.readFile(path.join(process.cwd(), relativePath))
  return `data:${reference.mime};base64,${buffer.toString('base64')}`
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractResponse>> {
  try {
    const { refId } = await request.json()

    if (!refId) {
      return NextResponse.json(
        { success: false, error: 'No refId provided' },
        { status: 400 }
      )
    }

    // Check if already extracted
    const existing = await getFacetPackByRefId(refId)
    if (existing) {
      return NextResponse.json({ success: true, facetPack: existing })
    }

    // Get reference
    const reference = await getReference(refId)
    if (!reference) {
      return NextResponse.json(
        { success: false, error: 'Reference not found' },
        { status: 404 }
      )
    }

    const imageDataUrl = await getReferenceImageDataUrl(reference)

    if (!imageDataUrl) {
      return NextResponse.json(
        { success: false, error: 'Reference has no image data' },
        { status: 400 }
      )
    }

    // Extract colors (local algorithm)
    const extractedColors = await extractColorsFromBase64(
      imageDataUrl,
      6
    )
    const colorTokens = assignColorRoles(extractedColors)

    // Update evidence with refId
    colorTokens.forEach((token) => {
      token.evidence.refId = refId
    })

    // Extract typography (LLM or mock)
    const typographyValue = await extractTypography(imageDataUrl)
    const typographyToken = {
      id: nanoid(),
      facetType: 'typography' as const,
      role: 'typography.main',
      confidence: 0.75,
      evidence: { refId },
      value: typographyValue,
    }

    // Extract layout (LLM or mock)
    const layoutValue = await extractLayout(imageDataUrl)
    const layoutToken = {
      id: nanoid(),
      facetType: 'layout' as const,
      role: 'layout.main',
      confidence: 0.7,
      evidence: { refId },
      value: layoutValue,
    }

    // Generate spacing token based on layout density
    const spacingToken: SpacingFacetToken = {
      id: nanoid(),
      facetType: 'spacing',
      role: 'spacing.main',
      confidence: 0.7,
      evidence: { refId },
      value: {
        baseUnit: layoutValue.density === 'compact' ? 4 : 8,
        scale:
          layoutValue.density === 'compact'
            ? [4, 8, 12, 16, 24, 32]
            : [8, 16, 24, 32, 48, 64],
        density: layoutValue.density === 'unknown' ? 'comfortable' : layoutValue.density,
      },
    }

    // Generate component style token
    const componentStyleToken: ComponentStyleFacetToken = {
      id: nanoid(),
      facetType: 'componentStyle',
      role: 'componentStyle.main',
      confidence: 0.7,
      evidence: { refId },
      value: {
        radius: 'md',
        shadow: 'sm',
        border: 'subtle',
      },
    }

    // Extract mood keywords (LLM or mock)
    const moodKeywords = await extractMood(imageDataUrl)

    // Create facet pack
    const facetPack: FacetPack = {
      id: nanoid(),
      refId,
      tokens: [
        ...colorTokens,
        typographyToken,
        layoutToken,
        spacingToken,
        componentStyleToken,
      ],
      summary: { moodKeywords },
      createdAt: Date.now(),
    }

    // Save to database
    await saveFacetPack(facetPack)

    return NextResponse.json({ success: true, facetPack })
  } catch (error) {
    console.error('Facet extraction error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
