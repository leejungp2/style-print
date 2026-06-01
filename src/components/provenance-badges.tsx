'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getReferenceImageSrc } from '@/lib/references'
import { ArrowRight, Wrench } from 'lucide-react'
import type { ProvenanceBadge, ReferenceAsset } from '@/lib/types'

interface ProvenanceBadgesProps {
  badges: ProvenanceBadge[]
  references: ReferenceAsset[]
}

export function ProvenanceBadges({ badges, references }: ProvenanceBadgesProps) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No provenance data available</p>
      </div>
    )
  }

  // Group badges by facet category
  const groupedBadges = badges.reduce(
    (acc, badge) => {
      const category = badge.facetKey.split('.')[0]
      if (!acc[category]) acc[category] = []
      acc[category].push(badge)
      return acc
    },
    {} as Record<string, ProvenanceBadge[]>
  )

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      palette: '🎨',
      typography: '🔤',
      layout: '📐',
      spacing: '📏',
      componentStyle: '🎛️',
    }
    return icons[category] || '📌'
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedBadges).map(([category, categoryBadges]) => (
        <div key={category}>
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span>{getCategoryIcon(category)}</span>
            <span className="capitalize">{category}</span>
          </h4>
          <div className="space-y-2">
            {categoryBadges.map((badge, index) => {
              const ref = references.find((r) => r.id === badge.sourceRefId)
              const referenceImageSrc = getReferenceImageSrc(ref)

              return (
                <Card key={`${badge.facetKey}-${index}`} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Reference Thumbnail */}
                      {referenceImageSrc && (
                        <img
                          src={referenceImageSrc}
                          alt=""
                          className="w-10 h-10 rounded object-cover border"
                        />
                      )}

                      {/* Facet Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">
                            {badge.facetKey.split('.').slice(1).join('.')}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            from <span className="font-medium">{badge.sourceRefName}</span>
                          </span>
                        </div>

                        {/* Transformation Info */}
                        {badge.transformation && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Wrench className="h-3 w-3" />
                            <span>{badge.transformation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="pt-4 border-t">
        <p className="text-xs text-muted-foreground mb-2">Legend:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            <span>= Modified during repair</span>
          </div>
        </div>
      </div>
    </div>
  )
}
