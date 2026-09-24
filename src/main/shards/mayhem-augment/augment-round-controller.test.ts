import { observable, reaction } from 'mobx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MayhemAugmentRoundController } from './augment-round-controller'
import type { MayhemAugmentMainContext } from './context'
import { MayhemAugmentState } from './state'

/** 用 MobX 真实 reaction 驱动的最小上下文，模拟 gameflow 与 Live Client 等级。 */
function createHarness() {
  const state = new MayhemAugmentState()

  let level = 1
  let activePlayerAvailable = true
  const getActivePlayer = vi.fn(async () => {
    if (!activePlayerAvailable) throw new Error('ECONNREFUSED')
    return { data: { level } }
  })

  const mobxBox = observable(
    {
      gameflow: { phase: null as string | null, session: null as any },
      summoner: { me: { puuid: 'self-puuid' } }
    },
    {},
    { deep: true }
  )

  const context = {
    namespace: 'mayhem-augment-main',
    gameClient: { api: { getActivePlayer } },
    leagueClient: { data: mobxBox },
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    mobxUtils: { reaction },
    state
  } as unknown as MayhemAugmentMainContext

  const setGameflow = (phase: string | null, gameId: number | null, gameMode: string | null) => {
    mobxBox.gameflow.phase = phase
    mobxBox.gameflow.session =
      gameId === null
        ? null
        : {
            gameData: {
              gameId,
              queue: { gameMode },
              playerChampionSelections: [{ puuid: 'self-puuid', championId: 157 }]
            }
          }
  }

  return {
    context,
    state,
    setGameflow,
    setLevel: (value: number) => (level = value),
    setActivePlayerAvailable: (value: boolean) => (activePlayerAvailable = value),
    getActivePlayer
  }
}

describe('MayhemAugmentRoundController', () => {
  let harness: ReturnType<typeof createHarness>
  let controller: MayhemAugmentRoundController

  beforeEach(() => {
    vi.useFakeTimers()
    harness = createHarness()
    controller = new MayhemAugmentRoundController(harness.context)
    controller.watch()
  })

  afterEach(() => {
    controller.dispose()
    vi.useRealTimers()
  })

  it('creates a session only for in-progress KIWI games and resolves the local champion', async () => {
    harness.setGameflow('InProgress', 1, 'ARAM')
    expect(harness.state.session).toBeNull()

    harness.setGameflow('InProgress', 2, 'KIWI')
    expect(harness.state.session?.gameId).toBe(2)
    expect(harness.state.session?.championId).toBe(157)
    expect(harness.state.session?.rounds.map((round) => round.level)).toEqual([3, 7, 11, 15])
  })

  it('marks rounds as reached when the live level crosses 3/7/11/15 and survives poll failures', async () => {
    // 加载阶段 2999 端口尚未就绪：轮询失败不应影响会话，也不应记录等级。
    harness.setActivePlayerAvailable(false)
    harness.setGameflow('InProgress', 3, 'KIWI')
    await vi.advanceTimersByTimeAsync(2500)
    expect(harness.state.session?.level).toBe(0)

    harness.setActivePlayerAvailable(true)
    harness.setLevel(7)
    await vi.advanceTimersByTimeAsync(2500)
    expect(harness.state.session?.level).toBe(7)
    expect(harness.state.session?.rounds.map((round) => round.reached)).toEqual([
      true,
      true,
      false,
      false
    ])
  })

  it('keeps the session through end-of-game phases and clears it afterwards', async () => {
    harness.setGameflow('InProgress', 4, 'KIWI')
    harness.setGameflow('EndOfGame', 4, 'KIWI')
    expect(harness.state.session?.gameId).toBe(4)

    harness.setGameflow('Lobby', null, null)
    expect(harness.state.session).toBeNull()
  })

  it('records offered and picked augments per round and keeps picks inside the offered list', () => {
    harness.setGameflow('InProgress', 5, 'KIWI')

    controller.setOfferedAugments(0, [11, 22, 22, 33, 44])
    expect(harness.state.session?.rounds[0].offeredAugmentIds).toEqual([11, 22, 33])

    controller.setPickedAugment(0, 99)
    expect(harness.state.session?.rounds[0].pickedAugmentId).toBe(99)
    expect(harness.state.session?.rounds[0].offeredAugmentIds).toEqual([22, 33, 99])

    controller.setOfferedAugments(0, [11, 22])
    expect(harness.state.session?.rounds[0].pickedAugmentId).toBeNull()

    expect(controller.setPickedAugment(9, 1)).toBeNull()
    expect(controller.setPickedAugment(0, -1)).toBeNull()
  })
})
