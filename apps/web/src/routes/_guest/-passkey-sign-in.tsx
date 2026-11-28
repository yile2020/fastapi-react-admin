import * as React from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { IconFingerprint, IconLoader2 } from "@tabler/icons-react"
import { passkeyEnabledQuery, passkeyErrorMessage, passkeySupported } from "@admin/platform/auth/passkey"
import { loginByPasskey } from "@admin/platform/auth/session"
import { Alert } from "@admin/ui/components/alert"
import { Button } from "@admin/ui/components/button"

/**
 * 登录页的「用通行密钥登录」。密码 / 手机两种方式下面都有，不用先输用户名（用哪把由认证器挑）。
 *
 * - 不显示的两种情况：浏览器不支持（含桌面端，见 `auth/passkey.ts`）· 服务端**明确**说没开
 * - 🔴 「开没开」那个查询**失败**时照样显示按钮：藏起来就是把服务端错误伪装成「没有这个功能」（硬纪律 9），
 *   点了按钮会走到真实的报错
 * - 查询还在路上时先不显示，免得按钮闪一下又没了
 */
export function PasskeySignIn({ onDone }: { onDone: () => Promise<void> }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const enabled = useQuery(passkeyEnabledQuery)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!passkeySupported() || enabled.isPending || enabled.data?.enabled === false) return null

  async function signIn() {
    setError(null)
    setPending(true)
    try {
      await loginByPasskey(qc)
      await onDone()
    } catch (err) {
      setError(passkeyErrorMessage(err, t))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3" data-testid="passkey-signin">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("或者")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full text-base"
        disabled={pending}
        onClick={() => void signIn()}
        data-testid="passkey-signin-button"
      >
        {pending ? <IconLoader2 className="size-4 animate-spin" /> : <IconFingerprint />}
        {t("用通行密钥登录")}
      </Button>
      {error && (
        <Alert tone="danger" data-testid="passkey-signin-error">
          {error}
        </Alert>
      )}
    </div>
  )
}
