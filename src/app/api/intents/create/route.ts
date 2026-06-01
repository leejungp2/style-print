import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { saveIntentSpec, getFacetPackByRefId } from '@/lib/db'
import type { IntentSpec, CreateIntentResponse, ColorRole } from '@/lib/types'

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateIntentResponse>> {
  try {
    const { chosen } = await request.json()

    if (!chosen) {
      return NextResponse.json(
        { success: false, error: 'No chosen facets provided' },
        { status: 400 }
      )
    }

    // Gather facet packs for normalization
    const normalized: IntentSpec['normalized'] = {}
    const provenance: IntentSpec['provenance'] = {}

    // Get color facets
    if (chosen.colorRefId) {
      const pack = await getFacetPackByRefId(chosen.colorRefId)
      if (pack) {
        const colorTokens = pack.tokens.filter((t) => t.facetType === 'color')
        const palette: Record<ColorRole, string> = {} as Record<ColorRole, string>
        colorTokens.forEach((t) => {
          if (t.facetType === 'color') {
            palette[t.value.role] = t.value.hex
            provenance[`palette.${t.value.role}`] = { refId: chosen.colorRefId! }
          }
        })
        normalized.palette = palette
      }
    }

    // Get typography facets
    if (chosen.typographyRefId) {
      const pack = await getFacetPackByRefId(chosen.typographyRefId)
      if (pack) {
        const typoToken = pack.tokens.find((t) => t.facetType === 'typography')
        if (typoToken && typoToken.facetType === 'typography') {
          normalized.typography = typoToken.value
          provenance['typography'] = { refId: chosen.typographyRefId }
        }
      }
    }

    // Get layout facets
    if (chosen.layoutRefId) {
      const pack = await getFacetPackByRefId(chosen.layoutRefId)
      if (pack) {
        const layoutToken = pack.tokens.find((t) => t.facetType === 'layout')
        if (layoutToken && layoutToken.facetType === 'layout') {
          normalized.layout = layoutToken.value
          provenance['layout'] = { refId: chosen.layoutRefId }
        }
      }
    }

    // Get spacing facets
    if (chosen.spacingRefId) {
      const pack = await getFacetPackByRefId(chosen.spacingRefId)
      if (pack) {
        const spacingToken = pack.tokens.find((t) => t.facetType === 'spacing')
        if (spacingToken && spacingToken.facetType === 'spacing') {
          normalized.spacing = spacingToken.value
          provenance['spacing'] = { refId: chosen.spacingRefId }
        }
      }
    }

    // Get component style facets
    if (chosen.componentStyleRefId) {
      const pack = await getFacetPackByRefId(chosen.componentStyleRefId)
      if (pack) {
        const styleToken = pack.tokens.find((t) => t.facetType === 'componentStyle')
        if (styleToken && styleToken.facetType === 'componentStyle') {
          normalized.componentStyle = styleToken.value
          provenance['componentStyle'] = { refId: chosen.componentStyleRefId }
        }
      }
    }

    const intentSpec: IntentSpec = {
      id: nanoid(),
      chosen,
      normalized,
      provenance,
      conflicts: [],
      repairs: [],
      history: [],
      createdAt: Date.now(),
    }

    await saveIntentSpec(intentSpec)

    return NextResponse.json({ success: true, intentSpec })
  } catch (error) {
    console.error('Intent creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
