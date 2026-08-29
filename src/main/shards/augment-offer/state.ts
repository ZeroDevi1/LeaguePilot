import type { AugmentOfferSnapshot } from '@shared/types/augment-offer'
import { makeAutoObservable, observableStruct } from 'mobx'

import { createEmptyAugmentOfferSnapshot } from './constants'

export class AugmentOfferState {
  snapshot: AugmentOfferSnapshot = createEmptyAugmentOfferSnapshot()

  constructor() {
    makeAutoObservable(this, {
      snapshot: observableStruct
    })
  }
}
