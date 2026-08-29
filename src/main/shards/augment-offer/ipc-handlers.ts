import type { AugmentOfferMainContext } from './context'
import type { AugmentOfferMain } from './index'

export class AugmentOfferIpcHandlers {
  constructor(
    private readonly context: AugmentOfferMainContext,
    private readonly augmentOffer: AugmentOfferMain
  ) {}

  register() {
    const { ipc, namespace } = this.context

    ipc.onCall(namespace, 'scanNow', async () => {
      return this.augmentOffer.scanNow()
    })
  }
}
