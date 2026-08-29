import {
  ARAMMETA_HEX_RARITIES,
  type ArammetaChampionHexPicks,
  type ArammetaHexCatalog,
  type ArammetaHexPick,
  type ArammetaHexSlotStat
} from '@shared/types/arammeta'

/**
 * 从 arammeta 公开 payload 抽出英雄×海克斯历史统计。
 *
 * 只保留各英雄 `top` 稀有度桶和轮次样本；丢弃 Draft、装备、协同和全局增幅榜。
 *
 * @param response 未经信任的 `tier-list.json`。
 * @returns 至少含一个合法英雄海克斯列表时返回目录，否则返回 `null`。
 */
export function adaptArammetaHexCatalog(response: unknown): ArammetaHexCatalog | null {
  if (!isRecord(response) || !isRecord(response.champs)) {
    return null
  }

  const champions: Record<number, ArammetaChampionHexPicks> = {}
  for (const [key, value] of Object.entries(response.champs)) {
    const championId = Number(key)
    if (!Number.isInteger(championId) || championId <= 0 || !isRecord(value)) {
      continue
    }

    const picks = toChampionHexPicks(value.top)
    if (picks) {
      champions[championId] = picks
    }
  }

  if (Object.keys(champions).length === 0) {
    return null
  }

  return {
    patchPrefix:
      typeof response.patch_prefix === 'string' && /^\d+(?:\.\d+)*$/.test(response.patch_prefix)
        ? response.patch_prefix
        : null,
    champions
  }
}

/** 把一个英雄的 `top` 稀有度桶整理成稳定视图模型。 */
function toChampionHexPicks(top: unknown): ArammetaChampionHexPicks | null {
  if (!isRecord(top)) {
    return null
  }

  const picks: ArammetaChampionHexPicks = {
    top: {
      kPrismatic: [],
      kGold: [],
      kSilver: []
    }
  }

  let hasPicks = false
  for (const rarity of ARAMMETA_HEX_RARITIES) {
    const rows = toHexPicks(top[rarity])
    if (rows.length > 0) {
      picks.top[rarity] = rows
      hasPicks = true
    }
  }

  return hasPicks ? picks : null
}

/** 把稀有度桶中的海克斯行转换成只依赖 Riot ID 的统计。 */
function toHexPicks(rows: unknown): ArammetaHexPick[] {
  if (!Array.isArray(rows)) {
    return []
  }

  return rows.flatMap((row) => {
    const pick = toHexPick(row)
    return pick ? [pick] : []
  })
}

/** 校验并转换一条英雄×海克斯统计。 */
function toHexPick(value: unknown): ArammetaHexPick | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toPositiveId(value.id)
  if (
    id === null ||
    !isNonNegativeInteger(value.g) ||
    !isRate(value.wr) ||
    !isFiniteNumber(value.lift) ||
    !isRate(value.pick)
  ) {
    return null
  }

  return {
    id,
    games: value.g,
    winRate: value.wr,
    lift: value.lift,
    pickRate: value.pick,
    slots: toSlotStats(value.slots)
  }
}

/** 把最多四轮节点统计整理成固定长度列表；非法项记为 `null`。 */
function toSlotStats(value: unknown): Array<ArammetaHexSlotStat | null> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, 4).map((slot) => {
    if (!isRecord(slot) || !isNonNegativeInteger(slot.g) || !isRate(slot.wr)) {
      return null
    }

    return {
      games: slot.g,
      winRate: slot.wr
    }
  })
}

/** 判断值是否为普通键值对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 判断值是否为有限数字。 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 判断值是否为非负整数。 */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** 判断值是否为 0 到 1 的比率。 */
function isRate(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1
}

/** 从纯数字读取正数 Riot ID。 */
function toPositiveId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  return null
}
