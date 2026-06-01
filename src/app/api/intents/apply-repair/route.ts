import { NextRequest, NextResponse } from 'next/server'
import { getIntentSpec, saveIntentSpec } from '@/lib/db'
import type { ApplyRepairResponse } from '@/lib/types'

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApplyRepairResponse>> {
  try {
    const { intentSpecId, repairPlanId } = await request.json()

    if (!intentSpecId || !repairPlanId) {
      return NextResponse.json(
        { success: false, error: 'Missing intentSpecId or repairPlanId' },
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

    // Find the repair plan
    const repair = intentSpec.repairs.find((r) => r.id === repairPlanId)
    if (!repair) {
      return NextResponse.json(
        { success: false, error: 'Repair plan not found' },
        { status: 404 }
      )
    }

    // Apply changes from the repair plan
    repair.changes.forEach((change) => {
      const keyParts = change.key.split('.')

      if (keyParts[0] === 'palette' && intentSpec.normalized.palette) {
        const role = keyParts[1] as keyof typeof intentSpec.normalized.palette
        if (role in intentSpec.normalized.palette) {
          intentSpec.normalized.palette[role] = change.to as string
        }
      } else if (
        keyParts[0] === 'typography' &&
        intentSpec.normalized.typography
      ) {
        if (keyParts.length === 3 && keyParts[1] === 'scale') {
          const scaleKey = keyParts[2] as keyof typeof intentSpec.normalized.typography.scale
          if (scaleKey in intentSpec.normalized.typography.scale) {
            intentSpec.normalized.typography.scale[scaleKey] = change.to as number
          }
        }
      } else if (keyParts[0] === 'spacing' && intentSpec.normalized.spacing) {
        if (keyParts[1] === 'baseUnit') {
          intentSpec.normalized.spacing.baseUnit = change.to as 4 | 8
        }
      }
    })

    // Record the change in history
    intentSpec.history.push({
      ts: Date.now(),
      description: repair.title,
      patch: repair.changes.map((c) => ({
        key: c.key,
        from: c.from,
        to: c.to,
      })),
    })

    // Remove the applied repair and related conflicts
    intentSpec.repairs = intentSpec.repairs.filter((r) => r.id !== repairPlanId)
    intentSpec.conflicts = intentSpec.conflicts.filter((c) =>
      !c.suggestedRepairs.includes(repairPlanId)
    )

    // Update coherence score
    if (intentSpec.coherenceScore !== undefined && repair.scoreDelta) {
      intentSpec.coherenceScore = Math.min(
        100,
        intentSpec.coherenceScore + repair.scoreDelta
      )
    }

    // Save updated intent spec
    await saveIntentSpec(intentSpec)

    return NextResponse.json({ success: true, intentSpec })
  } catch (error) {
    console.error('Apply repair error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
