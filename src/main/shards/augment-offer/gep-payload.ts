import type { AugmentOfferItem } from '@shared/types/augment-offer'

import { AUGMENTS_INFO_KEY, PICKED_AUGMENT_INFO_KEY } from './constants'

const MAX_OFFER_COUNT = 3

export interface GepInfoUpdateLike {
  feature?: unknown
  key?: unknown
  value?: unknown
  category?: unknown
}

export type ParsedGepAugmentPayload =
  | { kind: 'offers'; items: { slot: number; sourceName: string }[] }
  | { kind: 'picked'; sourceName: string }
  | { kind: 'ignored' }
  | { kind: 'invalid'; reason: 'malformed-json' | 'invalid-shape' | 'empty-name' }

/**
 * 把 GEP 名称做成可稳定比较的键：去掉首尾空白、折叠连续空白、大小写折叠、Unicode 正规化。
 */
export function normalizeAugmentName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

class MalformedGepJsonError extends Error {}

function unwrapJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 2) {
    return value
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const looksLikeJson =
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))

  if (!looksLikeJson) {
    return value
  }

  try {
    return unwrapJsonValue(JSON.parse(trimmed), depth + 1)
  } catch {
    throw new MalformedGepJsonError()
  }
}

function readOfferName(entry: unknown): string | null {
  if (typeof entry === 'string') {
    const name = entry.trim()
    return name.length > 0 ? name : null
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const name = (entry as { name?: unknown }).name
  if (typeof name !== 'string') {
    return null
  }

  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseOfferSlot(key: string): number | null {
  const match = /^augment_(\d+)$/i.exec(key)
  if (!match) {
    return null
  }

  const slot = Number.parseInt(match[1], 10)
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_OFFER_COUNT) {
    return null
  }

  return slot
}

/**
 * 解析 `key=augments` 的字符串化 JSON。只接受 1 到 3 个带 name 的选项。
 */
export function parseAugmentsValue(value: unknown): ParsedGepAugmentPayload {
  let parsed: unknown
  try {
    parsed = unwrapJsonValue(value)
  } catch (error) {
    if (error instanceof MalformedGepJsonError) {
      return { kind: 'invalid', reason: 'malformed-json' }
    }
    throw error
  }

  if (parsed === undefined || parsed === null || parsed === '') {
    return { kind: 'ignored' }
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'invalid', reason: 'invalid-shape' }
  }

  const items: { slot: number; sourceName: string }[] = []
  for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
    const slot = parseOfferSlot(key)
    if (slot === null) {
      continue
    }

    const sourceName = readOfferName(entry)
    if (sourceName === null) {
      return { kind: 'invalid', reason: 'empty-name' }
    }

    items.push({ slot, sourceName })
  }

  items.sort((left, right) => left.slot - right.slot)

  if (items.length === 0) {
    return { kind: 'ignored' }
  }

  if (items.length > MAX_OFFER_COUNT) {
    return { kind: 'invalid', reason: 'invalid-shape' }
  }

  return { kind: 'offers', items }
}

/**
 * 解析 `key=picked_augment` 的名称。
 */
export function parsePickedAugmentValue(value: unknown): ParsedGepAugmentPayload {
  let unwrapped: unknown
  try {
    unwrapped = unwrapJsonValue(value)
  } catch (error) {
    if (error instanceof MalformedGepJsonError) {
      return { kind: 'invalid', reason: 'malformed-json' }
    }
    throw error
  }

  if (unwrapped === undefined || unwrapped === null || unwrapped === '') {
    return { kind: 'ignored' }
  }

  if (typeof unwrapped === 'string') {
    const sourceName = unwrapped.trim()
    if (!sourceName) {
      return { kind: 'invalid', reason: 'empty-name' }
    }
    return { kind: 'picked', sourceName }
  }

  const sourceName = readOfferName(unwrapped)
  if (sourceName === null) {
    return { kind: 'invalid', reason: 'invalid-shape' }
  }

  return { kind: 'picked', sourceName }
}

export function parseGepInfoUpdate(update: GepInfoUpdateLike): ParsedGepAugmentPayload {
  if (update.feature !== 'augments') {
    return { kind: 'ignored' }
  }

  if (update.key === AUGMENTS_INFO_KEY) {
    return parseAugmentsValue(update.value)
  }

  if (update.key === PICKED_AUGMENT_INFO_KEY) {
    return parsePickedAugmentValue(update.value)
  }

  return { kind: 'ignored' }
}

function visitKeyedValues(
  node: unknown,
  keys: string[],
  found: Record<string, unknown>,
  depth: number
) {
  if (!node || typeof node !== 'object' || depth > 6) {
    return
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (keys.includes(key) && found[key] === undefined) {
      found[key] = value
    }
    visitKeyedValues(value, keys, found, depth + 1)
  }
}

/**
 * 从 GEP `getInfo` 快照中抽出 `augments` / `picked_augment`，兼容多层包裹。
 */
export function extractAugmentPayloadsFromGepInfo(info: unknown): {
  offers: ParsedGepAugmentPayload
  picked: ParsedGepAugmentPayload
} {
  const found: Record<string, unknown> = {}
  visitKeyedValues(info, [AUGMENTS_INFO_KEY, PICKED_AUGMENT_INFO_KEY], found, 0)

  return {
    offers:
      found[AUGMENTS_INFO_KEY] === undefined
        ? { kind: 'ignored' }
        : parseAugmentsValue(found[AUGMENTS_INFO_KEY]),
    picked:
      found[PICKED_AUGMENT_INFO_KEY] === undefined
        ? { kind: 'ignored' }
        : parsePickedAugmentValue(found[PICKED_AUGMENT_INFO_KEY])
  }
}

export function toMappedOfferItems(
  items: { slot: number; sourceName: string }[],
  mapName: (sourceName: string) => number | null
): AugmentOfferItem[] {
  return items.map((item) => ({
    slot: item.slot,
    sourceName: item.sourceName,
    id: mapName(item.sourceName)
  }))
}

export function toMappedPickedItem(
  sourceName: string,
  mapName: (sourceName: string) => number | null
): AugmentOfferItem {
  return {
    slot: 0,
    sourceName,
    id: mapName(sourceName)
  }
}

export function serializeOfferFingerprint(offers: AugmentOfferItem[]): string {
  return JSON.stringify(
    offers.map((item) => ({
      slot: item.slot,
      sourceName: normalizeAugmentName(item.sourceName),
      id: item.id
    }))
  )
}
