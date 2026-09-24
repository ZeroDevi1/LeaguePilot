import { Dep, IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import type { MayhemAugmentSession } from '@shared/types/mayhem-augment'

import { AkariIpcRenderer } from '../ipc'
import { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'
import {
  MAYHEM_AUGMENT_MAIN_NAMESPACE,
  MAYHEM_AUGMENT_RENDERER_NAMESPACE,
  type MayhemAugmentRendererContext
} from './context'
import { syncMayhemAugmentState } from './state-sync'

@Shard(MayhemAugmentRenderer.id)
export class MayhemAugmentRenderer implements IAkariShardInitDispose {
  static id = MAYHEM_AUGMENT_RENDERER_NAMESPACE

  private readonly _context: MayhemAugmentRendererContext

  constructor(
    @Dep(AkariIpcRenderer) ipc: AkariIpcRenderer,
    @Dep(PiniaMobxUtilsRenderer) piniaMobxUtils: PiniaMobxUtilsRenderer
  ) {
    this._context = { ipc, piniaMobxUtils }
  }

  async onInit() {
    await syncMayhemAugmentState(this._context)
  }

  /**
   * 记录某一轮玩家看到的候选强化。
   *
   * @param roundIndex 轮次下标，0 到 3。
   * @param augmentIds 候选强化 ID，最多 3 个。
   * @returns 更新后的会话；没有进行中的会话时为 `null`。
   */
  setOfferedAugments(roundIndex: number, augmentIds: number[]) {
    return this._context.ipc.call<MayhemAugmentSession | null>(
      MAYHEM_AUGMENT_MAIN_NAMESPACE,
      'setOfferedAugments',
      roundIndex,
      augmentIds
    )
  }

  /**
   * 记录某一轮的最终选择。
   *
   * @param roundIndex 轮次下标，0 到 3。
   * @param augmentId 选中的强化 ID；`null` 表示清除。
   * @returns 更新后的会话；没有进行中的会话时为 `null`。
   */
  setPickedAugment(roundIndex: number, augmentId: number | null) {
    return this._context.ipc.call<MayhemAugmentSession | null>(
      MAYHEM_AUGMENT_MAIN_NAMESPACE,
      'setPickedAugment',
      roundIndex,
      augmentId
    )
  }

  /** 清空本局所有手动录入的候选与选择。 */
  clearManualEntries() {
    return this._context.ipc.call<MayhemAugmentSession | null>(
      MAYHEM_AUGMENT_MAIN_NAMESPACE,
      'clearManualEntries'
    )
  }
}
