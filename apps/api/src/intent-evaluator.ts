import { nanoid } from 'nanoid'
import type {
  CoherenceDimension,
  CoherenceDimensionScores,
  CoherenceEvaluation,
  CoherenceFinding,
  ConflictCard,
  IntentSpec,
  RepairPlan,
} from '@style-print-jung/shared'
import { adjustForContrast, calculateContrastRatio } from './color-extractor'

export const COHERENCE_EVALUATOR_VERSION = 'rules-v2'

const coherenceDimensions: CoherenceDimension[] = [
  'accessibility',
  'visualConsistency',
  'intentCoverage',
  'provenanceCoverage',
  'generationReadiness',
]

export function evaluateIntentSpec(intentSpec: IntentSpec): {
  conflicts: ConflictCard[]
  repairs: RepairPlan[]
  coherenceScore: number
  coherence: CoherenceEvaluation
} {
  const conflicts: ConflictCard[] = []
  const repairs: RepairPlan[] = []
  const findings: CoherenceFinding[] = []
  const deductions = createDimensionScores(0)

  const addFinding = (
    finding: CoherenceFinding,
    points: number
  ) => {
    findings.push(finding)
    deductions[finding.dimension] += points
  }

  if (intentSpec.normalized.palette) {
    const palette = intentSpec.normalized.palette
    const textColor = palette.text
    const bgColor = palette.background

    if (textColor && bgColor) {
      const ratio = calculateContrastRatio(textColor, bgColor)

      if (ratio < 4.5) {
        const conflictId = nanoid()
        const adjustedText = adjustForContrast(textColor, bgColor, 4.5)
        const repairId = nanoid()

        conflicts.push({
          id: conflictId,
          type: 'contrast',
          severity: ratio < 3 ? 'error' : 'warn',
          message: `Text color contrast is insufficient (${ratio.toFixed(2)}:1)`,
          rationale: 'WCAG AA requires minimum 4.5:1 for normal text',
          affectedKeys: ['palette.text', 'palette.background'],
          suggestedRepairs: [repairId],
        })
        addFinding({
          dimension: 'accessibility',
          severity: ratio < 3 ? 'error' : 'warn',
          message: `Text color contrast is insufficient (${ratio.toFixed(2)}:1)`,
          rationale: 'WCAG AA requires minimum 4.5:1 for normal text',
          affectedKeys: ['palette.text', 'palette.background'],
        }, ratio < 3 ? 20 : 10)

        repairs.push({
          id: repairId,
          title: 'Adjust text color for contrast',
          description: `Change text color from ${textColor} to ${adjustedText}`,
          changes: [{ key: 'palette.text', from: textColor, to: adjustedText }],
          explanation: 'Adjusted text color to meet WCAG AA standard (4.5:1)',
          scoreDelta: 15,
        })
      }
    }

    const primaryColor = palette.primary
    if (primaryColor && bgColor) {
      const ratio = calculateContrastRatio(primaryColor, bgColor)
      if (ratio < 3) {
        conflicts.push({
          id: nanoid(),
          type: 'contrast',
          severity: 'warn',
          message: `Primary color has low contrast with background (${ratio.toFixed(2)}:1)`,
          rationale: 'Accent colors should have at least 3:1 contrast for visibility',
          affectedKeys: ['palette.primary', 'palette.background'],
          suggestedRepairs: [],
        })
        addFinding({
          dimension: 'accessibility',
          severity: 'warn',
          message: `Primary color has low contrast with background (${ratio.toFixed(2)}:1)`,
          rationale: 'Accent colors should have at least 3:1 contrast for visibility',
          affectedKeys: ['palette.primary', 'palette.background'],
        }, 10)
      }
    }
  }

  if (intentSpec.normalized.typography && intentSpec.normalized.layout) {
    const bodySize = intentSpec.normalized.typography.scale.body
    const density = intentSpec.normalized.layout.density

    if (density === 'compact' && bodySize < 14) {
      const repairId = nanoid()
      conflicts.push({
        id: nanoid(),
        type: 'densityTypographyMismatch',
        severity: 'warn',
        message: 'Compact layout with small body text may hurt readability',
        rationale: 'Body text smaller than 14px in compact layouts is hard to read',
        affectedKeys: ['typography.scale.body', 'layout.density'],
        suggestedRepairs: [repairId],
      })
      addFinding({
        dimension: 'visualConsistency',
        severity: 'warn',
        message: 'Compact layout with small body text may hurt readability',
        rationale: 'Body text smaller than 14px in compact layouts is hard to read',
        affectedKeys: ['typography.scale.body', 'layout.density'],
      }, 10)

      repairs.push({
        id: repairId,
        title: 'Increase body font size',
        description: `Change body size from ${bodySize}px to 14px`,
        changes: [{ key: 'typography.scale.body', from: bodySize, to: 14 }],
        explanation: 'Increased to minimum readable size for compact layouts',
        scoreDelta: 10,
      })
    }
  }

  if (intentSpec.normalized.spacing) {
    const baseUnit = intentSpec.normalized.spacing.baseUnit
    const density = intentSpec.normalized.layout?.density

    if (density === 'compact' && baseUnit === 8) {
      conflicts.push({
        id: nanoid(),
        type: 'spacingScaleMismatch',
        severity: 'info',
        message: 'Spacing base unit (8px) might be too large for compact layout',
        rationale: 'Consider using 4px base unit for tighter spacing',
        affectedKeys: ['spacing.baseUnit', 'layout.density'],
        suggestedRepairs: [],
      })
      addFinding({
        dimension: 'visualConsistency',
        severity: 'info',
        message: 'Spacing base unit (8px) might be too large for compact layout',
        rationale: 'Consider using 4px base unit for tighter spacing',
        affectedKeys: ['spacing.baseUnit', 'layout.density'],
      }, 5)
    } else if (density === 'comfortable' && baseUnit === 4) {
      conflicts.push({
        id: nanoid(),
        type: 'spacingScaleMismatch',
        severity: 'info',
        message: 'Spacing base unit (4px) might be too tight for comfortable layout',
        rationale: 'Consider using 8px base unit for more breathing room',
        affectedKeys: ['spacing.baseUnit', 'layout.density'],
        suggestedRepairs: [],
      })
      addFinding({
        dimension: 'visualConsistency',
        severity: 'info',
        message: 'Spacing base unit (4px) might be too tight for comfortable layout',
        rationale: 'Consider using 8px base unit for more breathing room',
        affectedKeys: ['spacing.baseUnit', 'layout.density'],
      }, 5)
    }
  }

  addCoverageFindings(intentSpec, addFinding)
  addComponentStyleFindings(intentSpec, addFinding)

  const dimensions = coherenceDimensions.reduce((acc, dimension) => {
    acc[dimension] = clampScore(100 - deductions[dimension])
    return acc
  }, {} as CoherenceDimensionScores)

  const totalDeduction = coherenceDimensions.reduce(
    (sum, dimension) => sum + deductions[dimension],
    0
  )
  const coherenceScore = clampScore(100 - totalDeduction)
  const coherence: CoherenceEvaluation = {
    score: coherenceScore,
    dimensions,
    findings,
    evaluatorVersion: COHERENCE_EVALUATOR_VERSION,
    evaluatedAt: Date.now(),
  }

  return {
    conflicts,
    repairs,
    coherenceScore,
    coherence,
  }
}

function addCoverageFindings(
  intentSpec: IntentSpec,
  addFinding: (finding: CoherenceFinding, points: number) => void
) {
  const requiredFacets: Array<{
    key: keyof IntentSpec['normalized']
    affectedKey: string
  }> = [
    { key: 'palette', affectedKey: 'palette' },
    { key: 'typography', affectedKey: 'typography' },
    { key: 'layout', affectedKey: 'layout' },
    { key: 'spacing', affectedKey: 'spacing' },
  ]

  requiredFacets.forEach(({ key, affectedKey }) => {
    if (!intentSpec.normalized[key]) {
      addFinding({
        dimension: 'intentCoverage',
        severity: 'warn',
        message: `IntentSpec is missing ${affectedKey} facet data`,
        rationale: 'Generation quality is less predictable when a core style facet is absent.',
        affectedKeys: [affectedKey],
      }, 8)
    }
  })

  Object.keys(intentSpec.normalized).forEach((facetKey) => {
    const hasFacetEvidence = Object.keys(intentSpec.provenance).some(
      (key) => key === facetKey || key.startsWith(`${facetKey}.`)
    )
    if (!hasFacetEvidence) {
      addFinding({
        dimension: 'provenanceCoverage',
        severity: 'info',
        message: `${facetKey} has no direct provenance evidence`,
        rationale: 'Traceable source evidence makes the resulting style easier to audit.',
        affectedKeys: [facetKey],
      }, 3)
    }
  })

  if (intentSpec.generationBrief) {
    const hasPrompt = intentSpec.generationBrief.prompt.trim().length > 0
    const hasScreens = intentSpec.generationBrief.screens.length > 0
    if (!hasPrompt && !hasScreens) {
      addFinding({
        dimension: 'generationReadiness',
        severity: 'info',
        message: 'Generation brief has no prompt or screen plan',
        rationale: 'A brief prompt or target screen list helps the exporter preserve intent.',
        affectedKeys: ['generationBrief'],
      }, 5)
    }
  }
}

function addComponentStyleFindings(
  intentSpec: IntentSpec,
  addFinding: (finding: CoherenceFinding, points: number) => void
) {
  const componentStyle = intentSpec.normalized.componentStyle
  const density = intentSpec.normalized.layout?.density
  if (!componentStyle || !density) return

  if (
    density === 'compact' &&
    (componentStyle.radius === 'xl' || componentStyle.shadow === 'lg')
  ) {
    addFinding({
      dimension: 'visualConsistency',
      severity: 'info',
      message: 'Compact layout uses visually heavy component styling',
      rationale: 'Large radius or shadows can make compact interfaces feel less dense.',
      affectedKeys: ['componentStyle', 'layout.density'],
    }, 5)
  }
}

function createDimensionScores(value: number): CoherenceDimensionScores {
  return coherenceDimensions.reduce((acc, dimension) => {
    acc[dimension] = value
    return acc
  }, {} as CoherenceDimensionScores)
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}
