import { MAYHEM_AUGMENT_MAIN_NAMESPACE, type MayhemAugmentRendererContext } from './context'
import { useMayhemAugmentStore } from './store'

export async function syncMayhemAugmentState(context: MayhemAugmentRendererContext) {
  const store = useMayhemAugmentStore()

  await context.piniaMobxUtils.sync(MAYHEM_AUGMENT_MAIN_NAMESPACE, 'state', store)
}
