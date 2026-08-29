import { is } from '@electron-toolkit/utils'

export const DEEP_LINK_PROTOCOL = is.dev ? 'league-pilot-dev' : 'league-pilot'

export const DEEP_LINK_PROTOCOL_PROD = 'league-pilot'

export const DEEP_LINK_PROTOCOL_DEV = 'league-pilot-dev'
