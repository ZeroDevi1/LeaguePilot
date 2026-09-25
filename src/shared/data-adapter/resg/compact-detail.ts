/**
 * 把 RESG 16.17 起的英雄详情位置元组展开成适配器已有的对象形状。
 *
 * 官网前端在展示前做同样的展开：排名行、单件装备、装备组合、海克斯和海克斯组合都不再是带 `tm` / `wr` 的对象，
 * 而是定长数组；胜率和选取率是万分比整数。对象形状的旧模块会原样通过。
 */

/** 万分比缩放。RESG 元组里的 10000 表示 100%，展开后恢复为 0 到 1。 */
const COMPACT_RATE_SCALE = 10_000

/**
 * 展开一份未经信任的 RESG 英雄详情。
 *
 * 只替换本功能会消费的详情段。英雄基础信息、`atp` 等其余字段保持原样；海克斯名称不在元组里，留空给客户端资源表补全。
 *
 * @param response RESG 英雄详情 JSON，可能是对象模块或位置元组模块。
 * @returns 排名行和统计段已展开的详情；输入不是对象时原样返回。
 */
export function expandResgCompactChampionDetail(response: unknown): unknown {
  if (!isRecord(response)) {
    return response
  }

  /** 展开后的详情副本，避免改写调用方持有的原始响应。 */
  const expanded: Record<string, unknown> = { ...response }
  replaceFields(expanded, ['builds', 'b'], expandBuildGroups)
  replaceFields(expanded, ['startingItems', 'si'], expandRankedRows)
  replaceFields(expanded, ['recommendedAugments', 'ra'], expandAugmentRows)
  replaceFields(expanded, ['itemAnalysis', 'ia'], expandItemAnalysis)
  replaceFields(expanded, ['augmentCombos', 'ac'], expandAugmentComboGroups)
  return expanded
}

/**
 * 把对象上第一个已存在的候选字段替换为展开结果。
 *
 * @param record 正在展开的详情副本。
 * @param keys 全称和短名，全称在前。
 * @param expand 对应字段的展开函数。
 * @returns 无返回值；两个候选字段都不存在时不做修改。
 */
function replaceFields(
  record: Record<string, unknown>,
  keys: readonly string[],
  expand: (value: unknown) => unknown
): void {
  for (const key of keys) {
    if (record[key] !== undefined) {
      record[key] = expand(record[key])
      return
    }
  }
}

/**
 * 展开 `builds` / `b` 下的召唤师技能、鞋子和技能优先级。
 *
 * @param groups 未经信任的方案分组。
 * @returns 每个数组分组都展开后的对象；输入不是对象时原样返回。
 */
function expandBuildGroups(groups: unknown): unknown {
  if (!isRecord(groups)) {
    return groups
  }

  /** 按 SPELLS、BOOTS、SKILL_ORDER 等类别展开后的方案。 */
  const expanded: Record<string, unknown> = {}
  for (const [kind, rows] of Object.entries(groups)) {
    expanded[kind] = expandRankedRows(rows)
  }
  return expanded
}

/**
 * 展开一组通用排名行。
 *
 * 元组顺序是 `[名次, 资源列表, 样本数, 胜场数, 胜率, 选取率]`。资源列表里的数字是装备或召唤师技能 ID，字符串是技能键。
 *
 * @param rows 未经信任的排名行数组或对象数组。
 * @returns 展开后的行；输入不是数组时原样返回。
 */
function expandRankedRows(rows: unknown): unknown {
  if (!Array.isArray(rows)) {
    return rows
  }

  return rows.map((row) => {
    if (!isCompactBuildRow(row)) {
      return row
    }

    const [rank, value, totalMatches, winMatches, winRate, pickRate] = row
    return {
      rank,
      value: expandBuildValue(value),
      tm: countOrZero(totalMatches),
      wm: countOrZero(winMatches),
      wr: scaleCompactRate(winRate),
      pr: scaleCompactRate(pickRate)
    }
  })
}

/**
 * 把排名行里的资源列表变成 `{ id, name }`。
 *
 * @param value 未经信任的资源列表。数字表示 Riot ID，字符串表示 Q/W/E 技能键。
 * @returns 适配器可识别的资源数组；不是紧凑列表时原样返回。
 */
function expandBuildValue(value: unknown): unknown {
  if (!Array.isArray(value) || value.length === 0) {
    return value
  }

  const first = value[0]
  if (typeof first === 'string') {
    return value.map((name) => ({ id: 0, name: String(name) }))
  }
  if (typeof first === 'number') {
    return value.map((id) => ({ id, name: '' }))
  }
  return value
}

/**
 * 展开独立海克斯推荐。
 *
 * 元组顺序是 `[ID, 品质, 样本数, 胜场数, 胜率, 选取率, ...]`。第 11 位是“高 / 中 / 观察”这类置信标签，不是显示名。
 *
 * @param rows 未经信任的海克斯行。
 * @returns 展开后的行；输入不是数组时原样返回。
 */
function expandAugmentRows(rows: unknown): unknown {
  if (!Array.isArray(rows)) {
    return rows
  }

  return rows.map((row) => {
    if (!isCompactAugmentRow(row)) {
      return row
    }

    const [id, quality, totalMatches, winMatches, winRate, pickRate] = row
    return {
      id,
      name: '',
      quality: countOrZero(quality),
      tm: countOrZero(totalMatches),
      wm: countOrZero(winMatches),
      wr: scaleCompactRate(winRate),
      pr: scaleCompactRate(pickRate)
    }
  })
}

/**
 * 展开单件装备和按件数分组的装备组合。
 *
 * @param analysis 未经信任的 `ia` 对象。
 * @returns 展开后的分析对象；输入不是对象时原样返回。
 */
function expandItemAnalysis(analysis: unknown): unknown {
  if (!isRecord(analysis)) {
    return analysis
  }

  return {
    ...analysis,
    items: expandItemStatRows(analysis.items),
    combos: expandGroupedRows(analysis.combos, expandItemComboRow)
  }
}

/**
 * 展开单件装备统计。
 *
 * 元组顺序是 `[装备 ID, 样本数, 胜场数, 胜率, 选取率]`，名次由数组顺序决定，与 RESG 前端一致。
 *
 * @param rows 未经信任的单件装备行。
 * @returns 展开后的行；输入不是数组时原样返回。
 */
function expandItemStatRows(rows: unknown): unknown {
  if (!Array.isArray(rows)) {
    return rows
  }

  return rows.map((row, index) => {
    if (!isCompactItemStatRow(row)) {
      return row
    }

    const [itemId, totalMatches, winMatches, winRate, pickRate] = row
    return {
      rank: index + 1,
      item: { id: itemId, name: '' },
      tm: countOrZero(totalMatches),
      wm: countOrZero(winMatches),
      wr: scaleCompactRate(winRate),
      pr: scaleCompactRate(pickRate)
    }
  })
}

/**
 * 展开一行核心装备组合。
 *
 * 元组顺序是 `[名次, 装备 ID 列表, 样本数, 胜场数, 胜率, 选取率]`。件数来自分组键，而不是行内字段。
 *
 * @param row 未经信任的组合行。
 * @param groupKey 分组键，例如 `"2"` 表示两件装。
 * @returns 展开后的组合；对象行原样返回。
 */
function expandItemComboRow(row: unknown, groupKey: string): unknown {
  if (!isCompactItemComboRow(row)) {
    return row
  }

  const [rank, items, totalMatches, winMatches, winRate, pickRate] = row
  return {
    id: rank,
    rank,
    size: Number(groupKey),
    items,
    tm: countOrZero(totalMatches),
    wm: countOrZero(winMatches),
    wr: scaleCompactRate(winRate),
    pr: scaleCompactRate(pickRate)
  }
}

/**
 * 展开按海克斯数量分组的组合。
 *
 * @param groups 未经信任的 `ac` 分组。
 * @returns 展开后的分组；输入不是对象时原样返回。
 */
function expandAugmentComboGroups(groups: unknown): unknown {
  return expandGroupedRows(groups, expandAugmentComboRow)
}

/**
 * 展开一条海克斯组合。
 *
 * 元组顺序是 `[跨分组 ID, 海克斯 ID 列表, 样本数, 胜场数, 胜率, 胜率差, 标记, 关联出装]`。
 * 第一位在 16.18 的双海克斯分组里会从 100 以上继续编号，所以展示名次用组内顺序，不用这个 ID。
 * 第六位是胜率差，不是选取率。
 *
 * @param row 未经信任的海克斯组合行。
 * @param groupKey 分组键，表示组合内的海克斯数量。
 * @param index 该行在分组数组中的下标，从 0 开始。
 * @returns 展开后的组合；对象行原样返回。
 */
function expandAugmentComboRow(row: unknown, groupKey: string, index: number): unknown {
  if (!isCompactAugmentComboRow(row)) {
    return row
  }

  const [id, augments, totalMatches, winMatches, winRate, , , builds] = row
  return {
    id,
    rank: index + 1,
    size: Number(groupKey),
    a: augments,
    tm: countOrZero(totalMatches),
    wm: countOrZero(winMatches),
    wr: scaleCompactRate(winRate),
    b: expandLinkedBuilds(builds)
  }
}

/**
 * 展开海克斯组合下的关联出装。
 *
 * 每条元组是 `[装备 ID 列表, 样本数, 胜率]`。
 *
 * @param builds 未经信任的关联出装列表。
 * @returns 展开后的出装；输入不是数组时返回空数组，让组合本身仍可被校验。
 */
function expandLinkedBuilds(builds: unknown): unknown[] {
  if (!Array.isArray(builds)) {
    return []
  }

  return builds.map((build) => {
    if (!isCompactLinkedBuild(build)) {
      return build
    }

    const [items, totalMatches, winRate] = build
    return {
      items,
      tm: countOrZero(totalMatches),
      wr: scaleCompactRate(winRate)
    }
  })
}

/**
 * 展开一个按字符串键分组的行表。
 *
 * @param groups 未经信任的分组对象。
 * @param expandRow 单行展开函数，会收到分组键和组内下标。
 * @returns 展开后的分组；输入不是对象时原样返回。
 */
function expandGroupedRows(
  groups: unknown,
  expandRow: (row: unknown, groupKey: string, index: number) => unknown
): unknown {
  if (!isRecord(groups)) {
    return groups
  }

  /** 保持 RESG 原始分组键和组内顺序。 */
  const expanded: Record<string, unknown> = {}
  for (const [groupKey, rows] of Object.entries(groups)) {
    expanded[groupKey] = Array.isArray(rows)
      ? rows.map((row, index) => expandRow(row, groupKey, index))
      : rows
  }
  return expanded
}

/** 判断一行是不是 `[名次, 资源列表, 样本, 胜场, 胜率, 选取率]`。 */
function isCompactBuildRow(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length >= 6 && Array.isArray(value[1])
}

/** 判断一行是不是 `[ID, 品质, 样本, 胜场, 胜率, 选取率, ...]`。品质是数字，因此不会和带资源列表的排名行混淆。 */
function isCompactAugmentRow(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length >= 6 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  )
}

/** 判断一行是不是 `[装备 ID, 样本, 胜场, 胜率, 选取率]`。 */
function isCompactItemStatRow(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length >= 5 &&
    value.slice(0, 5).every((slot) => typeof slot === 'number')
  )
}

/** 判断一行是不是 `[名次, 装备 ID 列表, 样本, 胜场, 胜率, 选取率]`。 */
function isCompactItemComboRow(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length >= 6 && Array.isArray(value[1])
}

/** 判断一行是不是 `[ID, 海克斯 ID 列表, 样本, 胜场, 胜率, ...]`。 */
function isCompactAugmentComboRow(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length >= 5 && Array.isArray(value[1])
}

/** 判断一条关联出装是不是 `[装备 ID 列表, 样本, 胜率]`。 */
function isCompactLinkedBuild(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length >= 3 && Array.isArray(value[0])
}

/**
 * 把元组中的万分比还原为比率。
 *
 * @param value 未经信任的比率槽。
 * @returns 除以 10000 后的比率；缺失或非有限数字时返回 0，超界值留给后续校验丢弃。
 */
function scaleCompactRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return value / COMPACT_RATE_SCALE
}

/**
 * 读取一个有限计数字段。
 *
 * @param value 未经信任的样本数、胜场数或品质。
 * @returns 有限数字；否则返回 0。
 */
function countOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 判断值是否为普通键值对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
