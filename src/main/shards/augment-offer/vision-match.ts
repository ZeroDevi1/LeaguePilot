import { ARAMMETA_HEX_SLOT_LEVELS } from '@shared/types/arammeta'

/** 从整屏截图中裁出三选一卡带的默认比例，对齐 mayhem-overlay 的中心带。 */
export const DEFAULT_OFFER_BAND = { x: 0.12, y: 0.22, w: 0.76, h: 0.56 }

/** 每张卡内部图标相对该卡的比例（居中偏上的方形）。 */
export const DEFAULT_ICON_IN_CARD = { x: 0.28, y: 0.16, w: 0.44, h: 0.36 }

/** dHash 接受距离；64 bit 下 12 大约允许描边/选中高亮。 */
export const VISION_MAX_HASH_DISTANCE = 12

/** 第一名与第二名的最小差距，避免两个相近图标互相抢。 */
export const VISION_MIN_HASH_MARGIN = 3

/** 判定截图几乎全黑（独占全屏/受保护画面）。 */
export const VISION_BLACK_FRAME_LUMA = 12

/** dHash 采样尺寸：9 列比较得到 8 bit × 8 行。 */
export const VISION_HASH_SIZE = { width: 9, height: 8 }

export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ScreenFractionRect {
  x: number
  y: number
  w: number
  h: number
}

export interface VisionHashCatalogEntry {
  id: number
  nameEn: string
  nameCn: string
  hash: bigint
}

/**
 * 已解锁的海克斯轮次数：等级达到 3 / 7 / 11 / 15 各算一轮。
 *
 * @param level Live Client 中的自身等级。
 */
export function unlockedAugmentRounds(level: number): number {
  let count = 0
  for (const node of ARAMMETA_HEX_SLOT_LEVELS) {
    if (level >= node) {
      count += 1
    }
  }
  return count
}

/**
 * 是否应该截屏识别当前三选一。
 *
 * 有未完成轮次、或当前已经识别出选项（要盯 reroll / 消失）时才截屏。
 */
export function shouldScanForAugmentOffer(input: {
  gameMode: string | null
  phase: string | null
  level: number | null
  completedRounds: number
  hasCurrentOffers: boolean
}): boolean {
  if (input.gameMode !== 'KIWI') {
    return false
  }

  if (input.phase !== 'InProgress' && input.phase !== 'Reconnect') {
    return false
  }

  if (input.level === null || !Number.isFinite(input.level) || input.level < 1) {
    return false
  }

  if (input.hasCurrentOffers) {
    return true
  }

  return input.completedRounds < unlockedAugmentRounds(input.level)
}

/**
 * 把三选一卡带切成三个图标矩形。
 *
 * @param imageWidth 截图像素宽。
 * @param imageHeight 截图像素高。
 */
export function iconRectsForOfferBand(
  imageWidth: number,
  imageHeight: number,
  band: ScreenFractionRect = DEFAULT_OFFER_BAND,
  iconInCard: ScreenFractionRect = DEFAULT_ICON_IN_CARD
): ScreenRect[] {
  const bandX = Math.round(imageWidth * band.x)
  const bandY = Math.round(imageHeight * band.y)
  const bandW = Math.round(imageWidth * band.w)
  const bandH = Math.round(imageHeight * band.h)
  const cardW = Math.floor(bandW / 3)

  return [0, 1, 2].map((slot) => {
    const cardX = bandX + slot * cardW
    const width = Math.max(8, Math.round(cardW * iconInCard.w))
    const height = Math.max(8, Math.round(bandH * iconInCard.h))
    return {
      x: cardX + Math.round((cardW - width) / 2),
      y: bandY + Math.round(bandH * iconInCard.y),
      width,
      height
    }
  })
}

/**
 * 从 8 行 × 9 列灰度图计算 64-bit difference hash。
 *
 * @param pixels 行优先灰度，长度必须为 `width * height`。
 */
export function differenceHashFromGray(pixels: Uint8Array, width: number, height: number): bigint {
  if (width < 2 || height < 1 || pixels.length < width * height) {
    return 0n
  }

  let hash = 0n
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width - 1; x++) {
      hash <<= 1n
      if (pixels[row + x] > pixels[row + x + 1]) {
        hash |= 1n
      }
    }
  }

  return hash
}

/**
 * 从 Electron NativeImage `toBitmap()` 的 BGRA 缓冲计算 dHash。
 *
 * 调用方应先把图缩放到 9×8。
 */
export function differenceHashFromBgra(bgra: Uint8Array, width: number, height: number): bigint {
  const gray = new Uint8Array(width * height)
  const pixelCount = Math.min(width * height, Math.floor(bgra.length / 4))
  for (let i = 0; i < pixelCount; i++) {
    const b = bgra[i * 4]
    const g = bgra[i * 4 + 1]
    const r = bgra[i * 4 + 2]
    gray[i] = (r * 77 + g * 150 + b * 29) >> 8
  }
  return differenceHashFromGray(gray, width, height)
}

/** 计算两个 hash 的汉明距离。 */
export function hammingDistance(left: bigint, right: bigint): number {
  let bits = left ^ right
  let count = 0
  while (bits !== 0n) {
    bits &= bits - 1n
    count += 1
  }
  return count
}

/**
 * 在目录中找最近且足够分离的图标。
 *
 * @returns 命中的 Riot 海克斯 ID；太远或与第二名太近时返回 `null`。
 */
export function matchIconHash(
  hash: bigint,
  catalog: VisionHashCatalogEntry[],
  options?: { maxDistance?: number; minMargin?: number }
): { id: number; distance: number } | null {
  if (catalog.length === 0) {
    return null
  }

  const maxDistance = options?.maxDistance ?? VISION_MAX_HASH_DISTANCE
  const minMargin = options?.minMargin ?? VISION_MIN_HASH_MARGIN

  let best: VisionHashCatalogEntry | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  let secondDistance = Number.POSITIVE_INFINITY

  for (const entry of catalog) {
    const distance = hammingDistance(hash, entry.hash)
    if (distance < bestDistance) {
      secondDistance = bestDistance
      bestDistance = distance
      best = entry
    } else if (distance < secondDistance) {
      secondDistance = distance
    }
  }

  if (!best || bestDistance > maxDistance) {
    return null
  }

  if (Number.isFinite(secondDistance) && secondDistance - bestDistance < minMargin) {
    return null
  }

  return { id: best.id, distance: bestDistance }
}

/**
 * 三个槽位必须都命中且 ID 互不相同，才视为一次完整三选一。
 */
export function uniqueMatchedIds(
  slots: Array<{ id: number } | null>
): [number, number, number] | null {
  if (slots.length !== 3 || slots.some((slot) => slot === null)) {
    return null
  }

  const ids = slots.map((slot) => slot!.id) as [number, number, number]
  if (new Set(ids).size !== 3) {
    return null
  }

  return ids
}

/**
 * 把 gtimg 海克斯大图标地址收成可请求的绝对 URL。
 */
export function resolveKiwiIconUrl(icon: string): string | null {
  const trimmed = icon.trim()
  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  return `https://game.gtimg.cn/${trimmed.replace(/^\//, '')}`
}

/**
 * 判断 BGRA 图是否几乎全黑。
 */
export function isNearlyBlackBgra(
  bgra: Uint8Array,
  width: number,
  height: number,
  lumaThreshold = VISION_BLACK_FRAME_LUMA
): boolean {
  const pixelCount = Math.min(width * height, Math.floor(bgra.length / 4))
  if (pixelCount === 0) {
    return true
  }

  let total = 0
  for (let i = 0; i < pixelCount; i++) {
    const b = bgra[i * 4]
    const g = bgra[i * 4 + 1]
    const r = bgra[i * 4 + 2]
    total += (r * 77 + g * 150 + b * 29) >> 8
  }

  return total / pixelCount < lumaThreshold
}
