import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getIntentSpec, saveAuditReport, getReference } from '@/lib/db'
import type { AuditResponse, AuditReport, FacetDiff, ProvenanceBadge } from '@/lib/types'

export async function POST(
  request: NextRequest
): Promise<NextResponse<AuditResponse>> {
  try {
    const { intentSpecId, code } = await request.json()

    if (!intentSpecId || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing intentSpecId or code' },
        { status: 400 }
      )
    }

    const intentSpec = await getIntentSpec(intentSpecId)
    if (!intentSpec) {
      return NextResponse.json(
        { success: false, error: 'IntentSpec not found' },
        { status: 404 }
      )
    }

    // Extract augmented facets from generated code
    const augmented = extractFacetsFromCode(code)

    // Calculate diffs
    const diffs = calculateDiffs(intentSpec.normalized, augmented)

    // Generate provenance badges
    const provenanceBadges = await generateProvenanceBadges(intentSpec)

    // Create audit report
    const report: AuditReport = {
      id: nanoid(),
      intentSpecId,
      generatedCodeId: '', // Would be set if we track generated code IDs
      augmented,
      diffs,
      provenanceBadges,
      createdAt: Date.now(),
    }

    // Save audit report
    await saveAuditReport(report)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    console.error('Audit analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Extract facets from generated code using regex patterns
function extractFacetsFromCode(code: string): AuditReport['augmented'] {
  const augmented: AuditReport['augmented'] = {}

  // Extract colors from Tailwind classes and inline styles
  const colorPattern = /(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/g
  const colors = code.match(colorPattern) || []
  if (colors.length > 0) {
    augmented.palette = {}
    colors.slice(0, 6).forEach((color, i) => {
      const roles = ['primary', 'secondary', 'accent', 'background', 'text', 'surface']
      augmented.palette![roles[i] || 'other'] = color
    })
  }

  // Extract typography info
  const fontFamilyMatch = code.match(/font-\[([\w\s,'-]+)\]|fontFamily:\s*['"]([^'"]+)['"]/i)
  const textSizeMatches: string[] = code.match(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl)/g) || []

  if (fontFamilyMatch || textSizeMatches.length > 0) {
    augmented.typography = {
      fontCandidates: fontFamilyMatch
        ? [{ name: fontFamilyMatch[1] || fontFamilyMatch[2] }]
        : [],
      scale: {
        h1: textSizeMatches.includes('text-4xl') ? 48 : 36,
        h2: textSizeMatches.includes('text-2xl') ? 32 : 24,
        body: textSizeMatches.includes('text-base') ? 16 : 14,
        caption: textSizeMatches.includes('text-xs') ? 12 : 10,
      },
    }
  }

  // Extract spacing
  const spacingMatches = code.match(/(p|m|gap)-([\d]+)/g) || []
  if (spacingMatches.length > 0) {
    const spacingValues = spacingMatches
      .map((m) => parseInt(m.match(/\d+/)?.[0] || '0') * 4)
      .filter((v) => v > 0)
    const uniqueSpacing = Array.from(new Set(spacingValues)).sort((a, b) => a - b)

    augmented.spacing = {
      baseUnit: uniqueSpacing[0] <= 4 ? 4 : 8,
      scale: uniqueSpacing.slice(0, 6),
    }
  }

  // Extract component style
  const hasRounded = /rounded-(sm|md|lg|xl)/.test(code)
  const hasShadow = /shadow-(sm|md|lg)/.test(code)
  const hasBorder = /border(-\d+)?/.test(code)

  if (hasRounded || hasShadow || hasBorder) {
    augmented.componentStyle = {
      radius: hasRounded
        ? (code.match(/rounded-(sm|md|lg|xl)/)?.[1] as any) || 'md'
        : 'none',
      shadow: hasShadow
        ? (code.match(/shadow-(sm|md|lg)/)?.[1] as any) || 'sm'
        : 'none',
      border: hasBorder ? 'subtle' : 'none',
    }
  }

  return augmented
}

// Calculate differences between intent and augmented
function calculateDiffs(
  normalized: any,
  augmented: any
): FacetDiff[] {
  const diffs: FacetDiff[] = []

  // Compare palette
  if (normalized.palette && augmented.palette) {
    Object.keys(normalized.palette).forEach((role) => {
      const expected = normalized.palette[role]
      const actual = augmented.palette?.[role]

      diffs.push({
        key: `palette.${role}`,
        expected,
        actual: actual || null,
        match: expected === actual ? 'exact' : actual ? 'different' : 'missing',
      })
    })
  }

  // Compare typography scale
  if (normalized.typography?.scale && augmented.typography?.scale) {
    Object.keys(normalized.typography.scale).forEach((key) => {
      const expected = normalized.typography.scale[key]
      const actual = augmented.typography?.scale?.[key]

      const deviation = actual
        ? Math.abs((actual - expected) / expected) * 100
        : 100

      diffs.push({
        key: `typography.scale.${key}`,
        expected,
        actual: actual || null,
        match:
          deviation === 0
            ? 'exact'
            : deviation < 10
              ? 'similar'
              : actual
                ? 'different'
                : 'missing',
      })
    })
  }

  // Compare spacing
  if (normalized.spacing?.baseUnit && augmented.spacing?.baseUnit) {
    const expected = normalized.spacing.baseUnit
    const actual = augmented.spacing.baseUnit

    diffs.push({
      key: 'spacing.baseUnit',
      expected,
      actual,
      match: expected === actual ? 'exact' : 'different',
    })
  }

  // Compare component style
  if (normalized.componentStyle && augmented.componentStyle) {
    ;['radius', 'shadow', 'border'].forEach((prop) => {
      const expected = normalized.componentStyle[prop]
      const actual = augmented.componentStyle?.[prop]

      diffs.push({
        key: `componentStyle.${prop}`,
        expected,
        actual: actual || null,
        match: expected === actual ? 'exact' : actual ? 'different' : 'missing',
      })
    })
  }

  return diffs
}

// Generate provenance badges from intent spec
async function generateProvenanceBadges(
  intentSpec: any
): Promise<ProvenanceBadge[]> {
  const badges: ProvenanceBadge[] = []

  // Create badges for each facet with provenance
  for (const [key, evidence] of Object.entries(intentSpec.provenance)) {
    const ev = evidence as any
    const ref = await getReference(ev.refId)

    if (ref) {
      badges.push({
        facetKey: key,
        sourceRefId: ev.refId,
        sourceRefName: ref.filename,
        transformation: ev.note,
      })
    }
  }

  // Add badges for repaired items
  intentSpec.history?.forEach((change: any) => {
    change.patch?.forEach((p: any) => {
      badges.push({
        facetKey: p.key,
        sourceRefId: intentSpec.provenance[p.key.split('.')[0]]?.refId || 'unknown',
        sourceRefName: 'Auto-repaired',
        transformation: change.description,
      })
    })
  })

  return badges
}
