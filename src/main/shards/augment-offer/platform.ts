export function shouldUseOverwolfGepProvider(platform: NodeJS.Platform = process.platform) {
  return platform === 'win32'
}

export function shouldUseScreenVisionProvider(platform: NodeJS.Platform = process.platform) {
  return platform === 'win32' || platform === 'darwin' || platform === 'linux'
}
