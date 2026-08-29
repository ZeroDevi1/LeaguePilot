import { describe, expect, test } from 'vitest'

import { createApplyUpdaterArguments, createUninstallUpdaterArguments } from './updater-command'

describe('updater command arguments', () => {
  test('keeps a volume root target in its own argv entry', () => {
    expect(
      createApplyUpdaterArguments({
        locale: 'zh-CN',
        archivePath: String.raw`C:\Users\Administrator\AppData\Roaming\league-pilot\NewUpdates\league-pilot-win-x64.7z`,
        targetPath: 'F:\\'
      })
    ).toEqual([
      '--lang',
      'zh-CN',
      '--executable',
      'LeaguePilot.exe',
      'apply',
      '--archive',
      String.raw`C:\Users\Administrator\AppData\Roaming\league-pilot\NewUpdates\league-pilot-win-x64.7z`,
      '--target',
      'F:\\',
      '--delete-archive',
      '--launch'
    ])
  })

  test('passes uninstall paths containing spaces without command-shell quotes', () => {
    const args = createUninstallUpdaterArguments({
      locale: 'en',
      appIds: ['league-pilot', 'league-pilot-dev'],
      appPath: String.raw`C:\LeaguePilot`,
      dataPath: String.raw`C:\Users\Pilot User\AppData\Roaming\league-pilot`
    })

    expect(args).toContain(String.raw`C:\LeaguePilot`)
    expect(args).toContain(String.raw`C:\Users\Pilot User\AppData\Roaming\league-pilot`)
    expect(args.every((arg) => !arg.includes('"'))).toBe(true)
  })
})
