import type { AkariIpcRenderer } from '../ipc'
import type { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'

export const MAYHEM_AUGMENT_MAIN_NAMESPACE = 'mayhem-augment-main'
export const MAYHEM_AUGMENT_RENDERER_NAMESPACE = 'mayhem-augment-renderer'

export interface MayhemAugmentRendererContext {
  ipc: AkariIpcRenderer
  piniaMobxUtils: PiniaMobxUtilsRenderer
}
