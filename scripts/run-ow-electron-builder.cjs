const { spawnSync } = require('node:child_process')
const path = require('node:path')

const {
  hasOverwolfDevCredentials,
  loadOverwolfDevEnv,
  resolvePackageCli
} = require('./ow-electron-env.cjs')

const repoRoot = path.resolve(__dirname, '..')
const rebuildScript = path.join(__dirname, 'clear-electron-rebuild-metadata.cjs')

loadOverwolfDevEnv()

if (process.platform !== 'win32') {
  console.error('[ow-electron] Windows packaging with GEP is Windows-only.')
  process.exit(1)
}

if (!hasOverwolfDevCredentials()) {
  console.warn(
    '[ow-electron] Building without Overwolf credentials. The packaged app will run, but GEP will not load until the app is signed in the Overwolf console.'
  )
}

function runNode(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }

  return result.status ?? 1
}

function restoreVanillaNativeModules() {
  const restoreStatus = runNode(rebuildScript, [])
  if (restoreStatus !== 0) {
    console.error(
      '[ow-electron] Failed to restore native modules for Electron 43. Run node scripts/clear-electron-rebuild-metadata.cjs before yarn dev.'
    )
  }

  return restoreStatus
}

let packStatus = 1

try {
  const rebuildStatus = runNode(rebuildScript, ['@overwolf/ow-electron'])
  if (rebuildStatus === 0) {
    const builderCli = resolvePackageCli('@overwolf/ow-electron-builder')
    packStatus = runNode(builderCli, [
      '--win',
      '--config',
      '--publish=never',
      '--config.directories.output=dist-overwolf',
      ...process.argv.slice(2)
    ])
  } else {
    packStatus = rebuildStatus
  }
} finally {
  const restoreStatus = restoreVanillaNativeModules()
  if (restoreStatus !== 0 && packStatus === 0) {
    packStatus = restoreStatus
  }
}

process.exit(packStatus)
