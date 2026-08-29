import type { AkariIpcRenderer } from '../ipc'
import type { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'

export const AUGMENT_OFFER_MAIN_NAMESPACE = 'augment-offer-main'
export const AUGMENT_OFFER_RENDERER_NAMESPACE = 'augment-offer-renderer'

export interface AugmentOfferRendererContext {
  ipc: AkariIpcRenderer
  piniaMobxUtils: PiniaMobxUtilsRenderer
}
