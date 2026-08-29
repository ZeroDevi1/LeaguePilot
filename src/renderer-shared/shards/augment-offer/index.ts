import { Dep, IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import type { AugmentOfferScanResult } from '@shared/types/augment-offer'

import { AkariIpcRenderer } from '../ipc'
import { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'
import {
  AUGMENT_OFFER_MAIN_NAMESPACE,
  AUGMENT_OFFER_RENDERER_NAMESPACE,
  type AugmentOfferRendererContext
} from './context'
import { syncAugmentOfferState } from './state-sync'

@Shard(AugmentOfferRenderer.id)
export class AugmentOfferRenderer implements IAkariShardInitDispose {
  static id = AUGMENT_OFFER_RENDERER_NAMESPACE

  private readonly _context: AugmentOfferRendererContext

  constructor(
    @Dep(AkariIpcRenderer) ipc: AkariIpcRenderer,
    @Dep(PiniaMobxUtilsRenderer) piniaMobxUtils: PiniaMobxUtilsRenderer
  ) {
    this._context = {
      ipc,
      piniaMobxUtils
    }
  }

  async onInit() {
    await syncAugmentOfferState(this._context)
  }

  scanNow() {
    return this._context.ipc.call<AugmentOfferScanResult>(AUGMENT_OFFER_MAIN_NAMESPACE, 'scanNow')
  }
}
