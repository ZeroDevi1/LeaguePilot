import type { GtimgKiwiAugments } from '@shared/data-sources/gtimg'
import type { AxiosInstance } from 'axios'
import { nativeImage } from 'electron'
import PQueue from 'p-queue'

import {
  VISION_HASH_SIZE,
  type VisionHashCatalogEntry,
  differenceHashFromBgra,
  resolveKiwiIconUrl
} from './vision-match'

const ICON_FETCH_CONCURRENCY = 8

/**
 * 从 PNG/JPEG 字节计算图标 dHash。
 */
export function hashIconImage(bytes: Buffer): bigint | null {
  const image = nativeImage.createFromBuffer(bytes)
  if (image.isEmpty()) {
    return null
  }

  const resized = image.resize({
    width: VISION_HASH_SIZE.width,
    height: VISION_HASH_SIZE.height,
    quality: 'best'
  })
  const size = resized.getSize()
  return differenceHashFromBgra(resized.toBitmap(), size.width, size.height)
}

/**
 * 下载 kiwi 大图标并建成哈希目录。
 *
 * 单个图标失败会被跳过，不让整份目录作废。
 */
export async function buildKiwiIconHashCatalog(
  augments: GtimgKiwiAugments[] | null,
  http: AxiosInstance
): Promise<VisionHashCatalogEntry[]> {
  if (!augments?.length) {
    return []
  }

  const queue = new PQueue({ concurrency: ICON_FETCH_CONCURRENCY })
  const catalog: VisionHashCatalogEntry[] = []

  await queue.addAll(
    augments.map((augment) => async () => {
      const url = resolveKiwiIconUrl(augment.large_Icon || augment.small_Icon)
      if (!url) {
        return
      }

      try {
        const { data } = await http.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 15_000
        })
        const hash = hashIconImage(Buffer.from(data))
        if (hash === null) {
          return
        }

        catalog.push({
          id: augment.augmentID,
          nameEn: augment.name_en,
          nameCn: augment.name_cn,
          hash
        })
      } catch {
        // 单个图标缺失不应阻断其余模板。
      }
    })
  )

  return catalog
}
