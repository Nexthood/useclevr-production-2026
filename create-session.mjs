import { createHmac, randomBytes } from 'crypto'

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

const secret = 'useclever-secret-key-32-characters-minimum'
const payload = {
  sub: 'demo-user-id',
  email: 'demo@useclevr.app',
  name: 'Demo User',
  picture: null,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
}

const token = signJwt(payload, secret)
console.log('Token:', token)
