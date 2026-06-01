import type { ReferenceAsset } from './types'

export function getReferenceImageSrc(
  reference?: Pick<ReferenceAsset, 'dataUrl' | 'url'> | null
): string | undefined {
  return reference?.url || reference?.dataUrl
}
