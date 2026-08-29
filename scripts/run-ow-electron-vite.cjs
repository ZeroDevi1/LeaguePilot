const { spawn } = require('node:child_process')
const path = require('node:path')

const {
  hasOverwolfDevCredentials,
  loadOverwolfDevEnv,
  resolveOverwolfElectronRuntime
} = require('./ow-electron-env.cjs')

const repoRoot = path.resolve(__dirname, '..')

loadOverwolfDevEnv()

if (process.platform !== 'win32') {
  console.error('[ow-electron] GEP is Windows-only. Run this script on Windows.')
  process.exit(1)
}

const runtime = resolveOverwolfElectronRuntime()
process.env.ELECTRON_EXEC_PATH = runtime.binaryPath
process.env.ELECTRON_MAJOR_VER = runtime.majorVersion

console.warn(
  `[ow-electron] Using ${runtime.packageName}@${runtime.version} (ABI differs from Electron 43). If better-sqlite3 fails to load, run yarn rebuild:overwolf. Switch back with node scripts/clear-electron-rebuild-metadata.cjs before yarn dev.`
)

if (!hasOverwolfDevCredentials()) {
  console.warn(
    '[ow-electron] Missing OW_DEV_KEY or OW_CLI_EMAIL + OW_CLI_API_KEY. The app will start, but GEP packages will stay inactive. Copy .env.overwolf.local.example to .env.overwolf.local.'
  )
}

const electronViteCli = require.resolve('electron-vite/bin/electron-vite.js')
const child = spawn(process.execPath, [electronViteCli, ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
