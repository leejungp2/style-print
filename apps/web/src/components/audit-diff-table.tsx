'use client'

import { Check, X, Minus, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FacetDiff } from '@/lib/types'

interface AuditDiffTableProps {
  diffs: FacetDiff[]
}

export function AuditDiffTable({ diffs }: AuditDiffTableProps) {
  if (diffs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Check className="h-12 w-12 mx-auto mb-3 text-green-500" />
        <p>All facets match perfectly!</p>
      </div>
    )
  }

  const getMatchIcon = (match: FacetDiff['match']) => {
    switch (match) {
      case 'exact':
        return <Check className="h-4 w-4 text-green-500" />
      case 'similar':
        return <Minus className="h-4 w-4 text-yellow-500" />
      case 'different':
        return <X className="h-4 w-4 text-red-500" />
      case 'missing':
        return <AlertCircle className="h-4 w-4 text-orange-500" />
    }
  }

  const getMatchBadge = (match: FacetDiff['match']) => {
    const variants: Record<FacetDiff['match'], 'success' | 'warning' | 'destructive' | 'secondary'> = {
      exact: 'success',
      similar: 'warning',
      different: 'destructive',
      missing: 'secondary',
    }
    return (
      <Badge variant={variants[match]} className="capitalize">
        {match}
      </Badge>
    )
  }

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // Group diffs by category
  const groupedDiffs = diffs.reduce(
    (acc, diff) => {
      const category = diff.key.split('.')[0]
      if (!acc[category]) acc[category] = []
      acc[category].push(diff)
      return acc
    },
    {} as Record<string, FacetDiff[]>
  )

  return (
    <div className="space-y-6">
      {Object.entries(groupedDiffs).map(([category, categoryDiffs]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold mb-3 capitalize">{category}</h4>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Property</th>
                  <th className="px-3 py-2 text-left font-medium">Expected</th>
                  <th className="px-3 py-2 text-left font-medium">Actual</th>
                  <th className="px-3 py-2 text-center font-medium">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {categoryDiffs.map((diff) => (
                  <tr
                    key={diff.key}
                    className={cn(
                      diff.match === 'exact' && 'bg-green-50 dark:bg-green-950/20',
                      diff.match === 'similar' && 'bg-yellow-50 dark:bg-yellow-950/20',
                      diff.match === 'different' && 'bg-red-50 dark:bg-red-950/20',
                      diff.match === 'missing' && 'bg-orange-50 dark:bg-orange-950/20'
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {diff.key.split('.').slice(1).join('.')}
                    </td>
                    <td className="px-3 py-2">
                      {diff.key.includes('color') || diff.key.includes('hex') ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: formatValue(diff.expected) }}
                          />
                          <span className="font-mono text-xs">
                            {formatValue(diff.expected)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">
                          {formatValue(diff.expected)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {diff.key.includes('color') || diff.key.includes('hex') ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: formatValue(diff.actual) }}
                          />
                          <span className="font-mono text-xs">
                            {formatValue(diff.actual)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">
                          {formatValue(diff.actual)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getMatchIcon(diff.match)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="success">
          {diffs.filter((d) => d.match === 'exact').length} Exact
        </Badge>
        <Badge variant="warning">
          {diffs.filter((d) => d.match === 'similar').length} Similar
        </Badge>
        <Badge variant="destructive">
          {diffs.filter((d) => d.match === 'different').length} Different
        </Badge>
        <Badge variant="secondary">
          {diffs.filter((d) => d.match === 'missing').length} Missing
        </Badge>
      </div>
    </div>
  )
}
