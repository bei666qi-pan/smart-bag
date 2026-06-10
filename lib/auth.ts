import 'server-only'

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import { redis } from '@/lib/redis'

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>

export const SESSION_COOKIE = 'sb_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 天

const userKey = (username: string) => `sb:user:${username.toLowerCase()}`
const sessionKey = (token: string) => `sb:session:${token}`

export type SessionUser = {
  username: string
  createdAt: string
  hasNewapiKey: boolean
}

// ---------- 密码哈希（scrypt，无额外依赖） ----------

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const derived = await scrypt(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

// ---------- 用户 ----------

export function validateCredentialsFormat(username: string, password: string) {
  if (!/^[\w一-龥-]{2,32}$/.test(username)) {
    return '用户名需为 2-32 位的字母、数字、下划线或中文'
  }
  if (password.length < 8 || password.length > 72) {
    return '密码长度需在 8-72 位之间'
  }
  return null
}

export async function createUser(username: string, password: string) {
  const key = userKey(username)
  const exists = await redis.exists(key)
  if (exists) return { ok: false as const, message: '用户名已被注册' }

  await redis.hset(key, {
    username,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  })
  return { ok: true as const }
}

export async function verifyUser(username: string, password: string) {
  const data = await redis.hgetall(userKey(username))
  if (!data?.passwordHash) return null
  const ok = await verifyPassword(password, data.passwordHash)
  return ok ? data.username : null
}

// ---------- 用户级 NewAPI 配置（API key 激活） ----------

export async function setUserNewapiConfig(
  username: string,
  config: { apiKey: string; baseUrl?: string },
) {
  await redis.hset(userKey(username), {
    newapiKey: config.apiKey,
    newapiBaseUrl: config.baseUrl ?? '',
  })
}

export async function clearUserNewapiConfig(username: string) {
  await redis.hdel(userKey(username), 'newapiKey', 'newapiBaseUrl')
}

export async function getUserNewapiConfig(username: string) {
  const data = await redis.hgetall(userKey(username))
  if (!data?.newapiKey) return null
  return {
    apiKey: data.newapiKey,
    baseUrl: data.newapiBaseUrl || undefined,
  }
}

// ---------- 会话 ----------

export async function createSession(username: string) {
  const token = randomBytes(32).toString('hex')
  await redis.set(sessionKey(token), username, 'EX', SESSION_TTL_SECONDS)
  return { token, maxAge: SESSION_TTL_SECONDS }
}

export async function destroySession(token: string) {
  await redis.del(sessionKey(token))
}

/** 从请求 cookie 解析当前登录用户；未登录返回 null。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const username = await redis.get(sessionKey(token))
    if (!username) return null
    // 滑动续期
    await redis.expire(sessionKey(token), SESSION_TTL_SECONDS)
    const data = await redis.hgetall(userKey(username))
    return {
      username,
      createdAt: data?.createdAt ?? '',
      hasNewapiKey: Boolean(data?.newapiKey),
    }
  } catch (error) {
    console.error('[Auth] 会话校验失败（Redis 不可用？）:', error)
    return null
  }
}

/** API 路由守卫：返回用户，或抛出可直接返回的 401。 */
export async function requireSessionUser() {
  const user = await getSessionUser()
  if (!user) {
    throw new AuthRequiredError()
  }
  return user
}

export class AuthRequiredError extends Error {
  constructor() {
    super('未登录或会话已过期')
    this.name = 'AuthRequiredError'
  }
}
