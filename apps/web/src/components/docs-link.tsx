import { useTranslation } from "react-i18next"
import { IconBook2 } from "@tabler/icons-react"

import { buttonVariants } from "@admin/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@admin/ui/components/tooltip"
import { cn } from "@admin/ui/lib/utils"

import { BRAND } from "@/lib/brand"

/**
 * 顶栏的文档站入口。DeepWiki 这类第三方解析挂在文档站的顶栏上，后台不再单独摆图标——
 * 那些地址改了只改文档站一处。GitHub 仓库入口照旧在旁边（`github-link.tsx`）。
 *
 * 界面是英文时直接进英文版（文档站中文在根路径、英文在 `/en/`）。
 */
export function DocsLink() {
  const { t, i18n } = useTranslation()
  const label = t("查看文档")
  const href = i18n.language?.startsWith("en") ? `${BRAND.docsUrl}en/` : BRAND.docsUrl
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="docs-link"
            aria-label={label}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-7")}
          />
        }
      >
        <IconBook2 className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
