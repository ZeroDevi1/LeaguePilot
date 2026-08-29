import 'reflect-metadata'

import { app } from 'electron'
import { join } from 'node:path'

import { bootstrap } from './bootstrap'

// 品牌重命名后继续复用原应用数据目录，避免升级时丢失数据库、设置和自动更新状态。
app.setPath('userData', join(app.getPath('appData'), 'league-akari'))

if (process.platform === 'win32') {
  app.setAppUserModelId('sugar.cocoa.league-pilot')
}

const gotTheLock = app.requestSingleInstanceLock()

if (gotTheLock) {
  bootstrap()
} else {
  app.quit()
}
