import { isIP } from 'node:net'

export const signupIp = req => {
  // req.ip is resolved by Express using the configured trusted proxy boundary.
  // Never accept an IP supplied in the signup body or take the first forwarded value blindly.
  const address = req.ip || req.socket?.remoteAddress
  if (typeof address !== 'string') return null
  const normalized = address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address
  return isIP(normalized) ? normalized : null
}

export const configureProxyTrust = app => {
  const configured = process.env.TRUST_PROXY_HOPS
  const hops = configured === undefined ? (process.env.RENDER === 'true' ? 1 : 0) : Number(configured)
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 10.')
  app.set('trust proxy', hops || false)
}
