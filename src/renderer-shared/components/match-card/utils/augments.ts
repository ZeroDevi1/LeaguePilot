export function filledAugmentIds(augments: readonly number[] | null | undefined): number[] {
  if (!augments?.length) {
    return []
  }

  return augments.filter((id) => id > 0)
}
