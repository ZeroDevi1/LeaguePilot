const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const repoRoot = path.resolve(__dirname, '..')
const localRequire = createRequire(path.join(repoRoot, 'package.json'))
const OVERWOLF_ELECTRON_PACKAGE = '@overwolf/ow-electron'
const OVERWOLF_ENV_FILE = path.join(repoRoot, '.env.overwolf.local')

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function loadOverwolfDevEnv(filePath = OVERWOLF_ENV_FILE) {
  if (!fs.existsSync(filePath)) {
    return false
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separator = trimmed.indexOf('=')
    if (separator <= 0) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    if (!key || process.env[key] !== undefined) {
      continue
    }

    process.env[key] = stripQuotes(trimmed.slice(separator + 1).trim())
  }

  return true
}

function hasOverwolfDevCredentials() {
  return Boolean(process.env.OW_DEV_KEY || (process.env.OW_CLI_EMAIL && process.env.OW_CLI_API_KEY))
}

function resolveElectronPackageJson(packageName) {
  return localRequire(path.join(packageName, 'package.json'))
}

function resolveElectronBinaryPath(packageName) {
  // `@overwolf/ow-electron` has no install lifecycle script. Requiring the
  // package runs the same download-on-missing path as vanilla `electron`.
  const binaryPath = localRequire(packageName)
  if (typeof binaryPath !== 'string' || !fs.existsSync(binaryPath)) {
    throw new Error(`Electron binary is missing for ${packageName}: ${binaryPath}`)
  }

  return binaryPath
}

function resolveOverwolfElectronRuntime() {
  const packageJson = resolveElectronPackageJson(OVERWOLF_ELECTRON_PACKAGE)
  const version = String(packageJson.version)
  return {
    packageName: OVERWOLF_ELECTRON_PACKAGE,
    version,
    majorVersion: version.split('.')[0],
    binaryPath: resolveElectronBinaryPath(OVERWOLF_ELECTRON_PACKAGE)
  }
}

function resolvePackageCli(packageName) {
  const packageJsonPath = localRequire.resolve(path.join(packageName, 'package.json'))
  const packageJson = localRequire(packageJsonPath)
  const bin = packageJson.bin
  const relativePath =
    typeof bin === 'string'
      ? bin
      : bin?.['ow-electron-builder'] || (bin ? bin[Object.keys(bin)[0]] : null)

  if (!relativePath) {
    throw new Error(`No bin entry found for ${packageName}`)
  }

  return path.join(path.dirname(packageJsonPath), relativePath)
}

module.exports = {
  OVERWOLF_ELECTRON_PACKAGE,
  OVERWOLF_ENV_FILE,
  hasOverwolfDevCredentials,
  loadOverwolfDevEnv,
  resolveElectronBinaryPath,
  resolveElectronPackageJson,
  resolveOverwolfElectronRuntime,
  resolvePackageCli
}
