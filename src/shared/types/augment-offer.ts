export type AugmentOfferSource = 'overwolf-gep' | 'screen-vision' | 'unsupported'

export type AugmentOfferAvailability =
  'unsupported' | 'unavailable' | 'waiting' | 'ready' | 'degraded' | 'error'

export interface AugmentOfferItem {
  id: number | null
  sourceName: string
  slot: number
}

export interface AugmentOfferSnapshot {
  availability: AugmentOfferAvailability
  source: AugmentOfferSource
  gameId: number | null
  offers: AugmentOfferItem[]
  picked: AugmentOfferItem | null
  updatedAt: number | null
  reason: string | null
}

/** 手动截屏识别一次三选一的结果。 */
export interface AugmentOfferScanResult {
  ok: boolean
  offers: AugmentOfferItem[]
  reason: string | null
}
