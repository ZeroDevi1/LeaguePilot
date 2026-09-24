import type { AkariIpcMain } from '../ipc'
import type { MayhemAugmentRoundController } from './augment-round-controller'
import type { MayhemAugmentMainContext } from './context'

export class MayhemAugmentIpcHandlers {
  constructor(
    private readonly _context: MayhemAugmentMainContext,
    private readonly _ipc: AkariIpcMain,
    private readonly _controller: MayhemAugmentRoundController
  ) {}

  register() {
    const { namespace } = this._context

    this._ipc.onCall(
      namespace,
      'setOfferedAugments',
      (_, roundIndex: number, augmentIds: number[]) =>
        this._controller.setOfferedAugments(roundIndex, Array.isArray(augmentIds) ? augmentIds : [])
    )
    this._ipc.onCall(
      namespace,
      'setPickedAugment',
      (_, roundIndex: number, augmentId: number | null) =>
        this._controller.setPickedAugment(roundIndex, augmentId)
    )
    this._ipc.onCall(namespace, 'clearManualEntries', () => this._controller.clearManualEntries())
  }
}
