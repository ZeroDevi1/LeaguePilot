import type { AugmentOfferItem, AugmentOfferSnapshot } from '@shared/types/augment-offer'

import { AUGMENT_OFFER_REASON } from './constants'
import { serializeOfferFingerprint } from './gep-payload'

export type AugmentOfferEvent =
  | { type: 'unsupported'; reason: string }
  | { type: 'unavailable'; reason: string; source?: AugmentOfferSnapshot['source'] }
  | { type: 'error'; reason: string; source?: AugmentOfferSnapshot['source'] }
  | { type: 'provider-ready'; source?: AugmentOfferSnapshot['source']; gameId?: number | null }
  | {
      type: 'offers'
      items: AugmentOfferItem[]
      receivedAt: number
      source?: AugmentOfferSnapshot['source']
    }
  | { type: 'picked'; item: AugmentOfferItem; receivedAt: number }
  | { type: 'clear-offers' }
  | { type: 'clear-match' }
  | { type: 'remap'; mapName: (sourceName: string) => number | null }

const EMPTY_READY_REASON = null

function withAvailability(
  items: AugmentOfferItem[],
  picked: AugmentOfferItem | null
): Pick<AugmentOfferSnapshot, 'availability' | 'reason'> {
  const hasUnmapped =
    items.some((item) => item.id === null) || (picked !== null && picked.id === null)

  if (hasUnmapped) {
    return {
      availability: 'degraded',
      reason: AUGMENT_OFFER_REASON.nameUnmapped
    }
  }

  return {
    availability: 'ready',
    reason: EMPTY_READY_REASON
  }
}

function remapItem(
  item: AugmentOfferItem,
  mapName: (sourceName: string) => number | null
): AugmentOfferItem {
  if (item.id !== null) {
    return item
  }

  return {
    ...item,
    id: mapName(item.sourceName)
  }
}

/**
 * 纯状态机：把 GEP 解析结果和运行时可用性收成稳定领域快照。
 */
export function reduceAugmentOfferSnapshot(
  snapshot: AugmentOfferSnapshot,
  event: AugmentOfferEvent
): AugmentOfferSnapshot {
  switch (event.type) {
    case 'unsupported':
      return {
        availability: 'unsupported',
        source: 'unsupported',
        gameId: null,
        offers: [],
        picked: null,
        updatedAt: null,
        reason: event.reason
      }
    case 'unavailable':
      return {
        ...snapshot,
        availability: 'unavailable',
        source: event.source ?? snapshot.source,
        reason: event.reason
      }
    case 'error':
      return {
        ...snapshot,
        availability: 'error',
        source: event.source ?? snapshot.source,
        reason: event.reason
      }
    case 'provider-ready': {
      const source = event.source ?? 'screen-vision'
      const hasMatchData = snapshot.offers.length > 0 || snapshot.picked !== null
      return {
        ...snapshot,
        availability: hasMatchData ? snapshot.availability : 'waiting',
        source,
        gameId: event.gameId ?? snapshot.gameId,
        reason: hasMatchData ? snapshot.reason : EMPTY_READY_REASON
      }
    }
    case 'clear-match':
      return {
        ...snapshot,
        offers: [],
        picked: null,
        updatedAt: null,
        availability:
          snapshot.availability === 'unsupported' || snapshot.availability === 'unavailable'
            ? snapshot.availability
            : 'waiting',
        reason:
          snapshot.availability === 'unsupported' || snapshot.availability === 'unavailable'
            ? snapshot.reason
            : EMPTY_READY_REASON
      }
    case 'clear-offers':
      if (snapshot.offers.length === 0) {
        return snapshot
      }

      return {
        ...snapshot,
        offers: [],
        updatedAt: snapshot.updatedAt,
        availability:
          snapshot.picked !== null ? withAvailability([], snapshot.picked).availability : 'waiting',
        reason:
          snapshot.picked !== null
            ? withAvailability([], snapshot.picked).reason
            : EMPTY_READY_REASON
      }
    case 'offers': {
      if (serializeOfferFingerprint(snapshot.offers) === serializeOfferFingerprint(event.items)) {
        return snapshot
      }

      const availability = withAvailability(event.items, null)
      return {
        ...snapshot,
        source: event.source ?? snapshot.source,
        offers: event.items,
        picked: null,
        updatedAt: event.receivedAt,
        availability: availability.availability,
        reason: availability.reason
      }
    }
    case 'picked': {
      const samePicked =
        snapshot.picked?.sourceName === event.item.sourceName &&
        snapshot.picked?.id === event.item.id
      if (samePicked) {
        return snapshot
      }

      const availability = withAvailability(snapshot.offers, event.item)
      return {
        ...snapshot,
        picked: event.item,
        updatedAt: event.receivedAt,
        availability: availability.availability,
        reason: availability.reason
      }
    }
    case 'remap': {
      if (snapshot.offers.length === 0 && snapshot.picked === null) {
        return snapshot
      }

      const offers = snapshot.offers.map((item) => remapItem(item, event.mapName))
      const picked = snapshot.picked ? remapItem(snapshot.picked, event.mapName) : null
      const availability = withAvailability(offers, picked)

      return {
        ...snapshot,
        offers,
        picked,
        availability: availability.availability,
        reason: availability.reason
      }
    }
  }
}
