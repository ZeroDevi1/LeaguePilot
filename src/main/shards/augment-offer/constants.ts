import type {
  AugmentOfferAvailability,
  AugmentOfferSnapshot,
  AugmentOfferSource
} from '@shared/types/augment-offer'

export const LOL_GEP_GAME_ID = 5426
export const AUGMENTS_GEP_FEATURE = 'augments'
export const AUGMENTS_INFO_KEY = 'augments'
export const PICKED_AUGMENT_INFO_KEY = 'picked_augment'

export const AUGMENT_OFFER_REASON = {
  platformUnsupported: 'platform-unsupported',
  gepRuntimeMissing: 'gep-runtime-missing',
  gepPackageFailed: 'gep-package-failed',
  elevatedPrivilegesRequired: 'elevated-privileges-required',
  setRequiredFeaturesFailed: 'set-required-features-failed',
  parseFailed: 'parse-failed',
  nameUnmapped: 'name-unmapped',
  nameConflict: 'name-conflict',
  screenCaptureUnavailable: 'screen-capture-unavailable',
  iconCatalogEmpty: 'icon-catalog-empty',
  noOfferDetected: 'no-offer-detected'
} as const

export function createEmptyAugmentOfferSnapshot(
  availability: AugmentOfferAvailability = 'waiting',
  reason: string | null = null,
  source: AugmentOfferSource = 'screen-vision'
): AugmentOfferSnapshot {
  return {
    availability,
    source,
    gameId: null,
    offers: [],
    picked: null,
    updatedAt: null,
    reason
  }
}
