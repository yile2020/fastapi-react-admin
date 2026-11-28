import { queryOptions } from '@tanstack/react-query'

import { api } from '../api-client/client'
import { ApiError } from '../api-client/errors'
import { tryDesktop } from '../desktop'

/**
 * 通行密钥（Passkey / WebAuthn）的浏览器那一侧。登录接在 `session.ts` 的 `loginByPasskey`，
 * 管理在个人中心（`pages/profile/passkey-block.tsx`）。
 *
 * - 用浏览器原生的 WebAuthn L3 JSON 方法（`parseCreationOptionsFromJSON` / `parseRequestOptionsFromJSON` / `toJSON`），
 *   不引 `@simplewebauthn/browser`：服务端给的 options 原样交进去，结果原样交回去
 * - 🔴 **桌面端一律当不支持**：渲染层跑在 `app://local` 上，凭据绑的是网站域名（RP ID），对不上 —— 按规范推出，没实测
 * - 🔴 **本地开发要从 `localhost` 打开页面**：RP ID 不能是 IP，从 `127.0.0.1` 打开时浏览器直接报 `SecurityError`
 *   （实测：Chrome 156 `This is an invalid domain.`）。见 `app/admin` 分册「通行密钥」
 */

/** 浏览器支不支持（三个 JSON 方法都在、不在桌面端） */
export function passkeySupported(): boolean {
  if (typeof window === 'undefined' || tryDesktop()) return false
  const pkc = window.PublicKeyCredential as unknown as
    | {
        parseCreationOptionsFromJSON?: unknown
        parseRequestOptionsFromJSON?: unknown
        prototype?: { toJSON?: unknown }
      }
    | undefined
  return (
    typeof pkc?.parseCreationOptionsFromJSON === 'function' &&
    typeof pkc?.parseRequestOptionsFromJSON === 'function' &&
    typeof pkc?.prototype?.toJSON === 'function'
  )
}

/** 服务端开没开（配了 PASSKEY_RP_ID + PASSKEY_ORIGINS）。匿名接口，登录页用 */
export const passkeyEnabledQuery = queryOptions({
  queryKey: ['auth', 'passkey', 'enabled'] as const,
  queryFn: () => api.GET<{ enabled: boolean }>('/api/v1/auth/passkey/enabled'),
  staleTime: 5 * 60_000,
})

type Json = Record<string, unknown>

/** 浏览器那一步被用户取消 / 超时：调用方据此不显示成「出错了」那种红字 */
export class PasskeyCancelled extends Error {}

function toCredentialJson(credential: Credential | null): Json {
  if (!credential) throw new PasskeyCancelled()
  return (credential as PublicKeyCredential).toJSON() as unknown as Json
}

/** 注册：服务端的 creation options → `navigator.credentials.create()` → 交回服务端的 JSON */
export async function createPasskeyCredential(options: Json): Promise<Json> {
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(
    options as unknown as PublicKeyCredentialCreationOptionsJSON
  )
  return toCredentialJson(await navigator.credentials.create({ publicKey }))
}

/** 登录：服务端的 request options → `navigator.credentials.get()` → 交回服务端的 JSON */
export async function getPasskeyAssertion(options: Json): Promise<Json> {
  const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(
    options as unknown as PublicKeyCredentialRequestOptionsJSON
  )
  return toCredentialJson(await navigator.credentials.get({ publicKey }))
}

/**
 * 浏览器 / 服务端的错误 → 给人看的一句话。
 *
 * 浏览器那一侧的 `DOMException` 名字比 message 可靠（message 各浏览器各写各的、还是英文）。
 * 「取消 / 超时」两件事浏览器故意不区分（隐私考虑，都是 `NotAllowedError`），这里也只能合成一句。
 */
export function passkeyErrorMessage(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof PasskeyCancelled) return t('已取消，或者等太久超时了')
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return t('已取消，或者等太久超时了')
    case 'InvalidStateError':
      return t('这台设备上的通行密钥已经添加过了')
    case 'SecurityError':
      return t('当前网址不能使用通行密钥，请用系统配置的域名打开页面')
    default:
      return t('通行密钥操作失败，请稍后重试')
  }
}
