import { AUGMENT_OFFER_MAIN_NAMESPACE, type AugmentOfferRendererContext } from './context'
import { useAugmentOfferStore } from './store'

export async function syncAugmentOfferState(context: AugmentOfferRendererContext) {
  const store = useAugmentOfferStore()

  await context.piniaMobxUtils.sync(AUGMENT_OFFER_MAIN_NAMESPACE, 'state', store)
}
