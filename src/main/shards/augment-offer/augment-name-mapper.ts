import type { GtimgKiwiAugments } from '@shared/data-sources/gtimg'
import type { Augment } from '@shared/types/league-client/game-data'

import { AUGMENT_OFFER_REASON } from './constants'
import { normalizeAugmentName } from './gep-payload'

const NAME_CONFLICT = Symbol('name-conflict')

export interface AugmentNameMapperDiagnostics {
  size: number
  conflicts: string[]
}

export class AugmentNameMapper {
  private readonly _idsByNormalizedName = new Map<string, number | typeof NAME_CONFLICT>()
  private readonly _conflicts: string[] = []

  constructor(
    kiwiAugments: GtimgKiwiAugments[] | null,
    lcuAugments: Record<number, Augment> | null
  ) {
    this._addKiwiAugments(kiwiAugments)
    this._addLcuAugments(lcuAugments)
  }

  get diagnostics(): AugmentNameMapperDiagnostics {
    return {
      size: this._idsByNormalizedName.size,
      conflicts: [...this._conflicts]
    }
  }

  mapName(sourceName: string): number | null {
    const normalized = normalizeAugmentName(sourceName)
    if (!normalized) {
      return null
    }

    const mapped = this._idsByNormalizedName.get(normalized)
    if (typeof mapped === 'number') {
      return mapped
    }

    return null
  }

  isConflict(sourceName: string): boolean {
    const normalized = normalizeAugmentName(sourceName)
    return normalized.length > 0 && this._idsByNormalizedName.get(normalized) === NAME_CONFLICT
  }

  private _addKiwiAugments(kiwiAugments: GtimgKiwiAugments[] | null) {
    if (!kiwiAugments) {
      return
    }

    for (const augment of kiwiAugments) {
      this._addName(augment.name_en, augment.augmentID)
      this._addName(augment.name_cn, augment.augmentID)
    }
  }

  private _addLcuAugments(lcuAugments: Record<number, Augment> | null) {
    if (!lcuAugments) {
      return
    }

    for (const augment of Object.values(lcuAugments)) {
      this._addName(augment.nameTRA, augment.id)
    }
  }

  private _addName(name: string | undefined, id: number) {
    if (typeof name !== 'string') {
      return
    }

    const normalized = normalizeAugmentName(name)
    if (!normalized) {
      return
    }

    const existing = this._idsByNormalizedName.get(normalized)
    if (existing === undefined) {
      this._idsByNormalizedName.set(normalized, id)
      return
    }

    if (existing !== id && existing !== NAME_CONFLICT) {
      this._idsByNormalizedName.set(normalized, NAME_CONFLICT)
      this._conflicts.push(normalized)
    }
  }
}

export function createAugmentNameMapper(
  kiwiAugments: GtimgKiwiAugments[] | null,
  lcuAugments: Record<number, Augment> | null
) {
  return new AugmentNameMapper(kiwiAugments, lcuAugments)
}

export function unmappedReason(mapper: AugmentNameMapper, sourceName: string): string {
  return mapper.isConflict(sourceName)
    ? AUGMENT_OFFER_REASON.nameConflict
    : AUGMENT_OFFER_REASON.nameUnmapped
}
