import type { MayhemAugmentSession } from '@shared/types/mayhem-augment'
import { makeAutoObservable, observableRef } from 'mobx'

/**
 * 海克斯大乱斗强化选择进度。
 *
 * `session` 以整体替换的方式更新，保证 propSync 到 renderer 的对象总是完整快照。
 */
export class MayhemAugmentState {
  /** 当前或刚结束的海克斯大乱斗对局；不在该模式对局中时为 `null`。 */
  session: MayhemAugmentSession | null = null

  setSession(session: MayhemAugmentSession | null) {
    this.session = session
  }

  constructor() {
    makeAutoObservable(this, {
      session: observableRef
    })
  }
}
