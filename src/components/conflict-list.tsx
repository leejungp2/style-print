'use client'

import { AlertTriangle, AlertCircle, Info, Wrench } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConflictCard, RepairPlan } from '@/lib/types'

interface ConflictListProps {
  conflicts: ConflictCard[]
  repairs: RepairPlan[]
  onApplyRepair: (repairId: string) => void
}

export function ConflictList({
  conflicts,
  repairs,
  onApplyRepair,
}: ConflictListProps) {
  if (conflicts.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">No conflicts detected</span>
        </div>
        <p className="text-sm">Your recipe is coherent and ready to generate!</p>
      </div>
    )
  }

  const getIcon = (severity: ConflictCard['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />
      case 'warn':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getSeverityColor = (severity: ConflictCard['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-destructive/50 bg-destructive/5'
      case 'warn':
        return 'border-yellow-500/50 bg-yellow-500/5'
      default:
        return 'border-blue-500/50 bg-blue-500/5'
    }
  }

  return (
    <div className="space-y-3">
      {conflicts.map((conflict) => {
        const repair = repairs.find((r) =>
          conflict.suggestedRepairs.includes(r.id)
        )

        return (
          <Card
            key={conflict.id}
            className={cn('border', getSeverityColor(conflict.severity))}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(conflict.severity)}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        conflict.severity === 'error'
                          ? 'destructive'
                          : conflict.severity === 'warn'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {conflict.type}
                    </Badge>
                  </div>
                  <p className="text-sm">{conflict.message}</p>
                  {conflict.rationale && (
                    <p className="text-xs text-muted-foreground">
                      {conflict.rationale}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {conflict.affectedKeys.map((key) => (
                      <Badge
                        key={key}
                        variant="outline"
                        className="text-xs font-mono"
                      >
                        {key}
                      </Badge>
                    ))}
                  </div>

                  {/* Repair Option */}
                  {repair && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Wrench className="h-3 w-3" />
                            {repair.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {repair.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onApplyRepair(repair.id)}
                        >
                          Apply Fix
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
