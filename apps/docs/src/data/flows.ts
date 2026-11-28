/**
 * 功能页「处理顺序」图（DiagramFlow.astro）的文字，中英文各一份，页面只写一行 `<DiagramFlow {...flows.xxx.zh} />`。
 * 放在这里的原因同 request-flow.ts：跨多行的 props 会漏进导出给 AI 读的 `.md`。
 *
 * 🔴 每张图都对着代码画，画之前读一遍推进逻辑：图和代码对不上没有任何检查会红。
 * 每一项旁边注明核对的是哪个函数，重构那段代码时回来改这里。
 */
export const flows = {
  /** plugin/workflow/service/runtime_service.py：start_in_tx → _advance（条件 / 抄送 / 审批人为空走 onEmpty）→ execute 的 reject 分支 → _finish */
  approval: {
    zh: {
      steps: [
        { name: '提交申请', sub: '校验表单，算出自动计算的值', branch: { when: '填写有误', name: '提交不了', sub: '提示哪一项不对' } },
        { name: '条件分支', sub: '按表单值选一条，没命中走兜底' },
        { name: '找审批人', sub: '按节点规则取人，去掉发起人', branch: { when: '取不到人', name: '按节点设置处理', sub: '驳回（默认）· 跳过 · 转管理员' } },
        { name: '审批', sub: '或签 · 会签 · 依次审批', branch: { when: '任一人驳回', name: '整单驳回', sub: '通知发起人' } },
        { name: '抄送', sub: '抄送节点的人收到通知' },
      ],
      end: { name: '审批通过', sub: '通知发起人' },
      caption: '每过一个审批节点重复「条件 → 找审批人 → 审批」，直到走完流程树。退回会回到之前的节点重走',
    },
    en: {
      steps: [
        { name: 'Submit', sub: 'Validate the form, compute derived values', branch: { when: 'Invalid input', name: 'Not submitted', sub: 'The bad field is named' } },
        { name: 'Condition', sub: 'Pick a branch by form values, else the default' },
        { name: 'Find approvers', sub: 'Resolve the node rule, drop the initiator', branch: { when: 'Nobody found', name: 'Node setting decides', sub: 'Reject (default) · skip · admin' } },
        { name: 'Approve', sub: 'Any · all · in sequence', branch: { when: 'Anyone rejects', name: 'Request rejected', sub: 'Initiator is notified' } },
        { name: 'CC', sub: 'CC recipients are notified' },
      ],
      end: { name: 'Approved', sub: 'Initiator is notified' },
      caption: 'Condition → approvers → approval repeats for every approval node until the tree ends. Sending back re-runs an earlier node',
    },
  },
  /**
   * packages/platform/src/upload/queue.ts 的 run()：hash → check（命中直接 done）→ upload（单次 / chunked.ts 分片）→ finalizing。
   * 校验在服务端：file_service（/upload）和 multipart_service.start（分片开始）同一份；complete 再校验一遍
   */
  upload: {
    zh: {
      steps: [
        { name: '算指纹', sub: '浏览器分块算 SHA-256' },
        { name: '秒传探测', sub: '查有没有传过同一个文件', branch: { when: '已经传过', name: '直接复用', sub: '一个字节都不传', tone: 'ok' as const } },
        { name: '服务端校验', sub: '扩展名 · 大小上限 · 公开件只收图片', branch: { when: '不通过', name: '上传失败', sub: '浮窗里显示原因' } },
        { name: '传字节', sub: '小文件一次传完，大文件 3 片并发', branch: { when: '断网 · 刷新', name: '会话保留 24 小时', sub: '重试或重新选文件续传' } },
        { name: '合并落库', sub: '分片读回合并，再校验一遍' },
      ],
      end: { name: '上传完成', sub: '出现在文件列表' },
      caption: '小于分片阈值（默认 16 MiB）的文件没有「合并」这一步。多个文件逐个排队，同一个文件的分片并发',
    },
    en: {
      steps: [
        { name: 'Fingerprint', sub: 'The browser hashes SHA-256 in chunks' },
        { name: 'Dedup check', sub: 'Has this exact file been uploaded?', branch: { when: 'Already there', name: 'Reused', sub: 'Not a single byte is sent', tone: 'ok' as const } },
        { name: 'Server checks', sub: 'Extension · size limit · public = images only', branch: { when: 'Fails', name: 'Upload failed', sub: 'Reason shown in the tray' } },
        { name: 'Send bytes', sub: 'Small files in one request, large ones 3 parts at a time', branch: { when: 'Offline · reload', name: 'Session kept 24 h', sub: 'Retry, or pick the file again to resume' } },
        { name: 'Assemble', sub: 'Parts read back, joined, checked again' },
      ],
      end: { name: 'Done', sub: 'Shows up in the file list' },
      caption: 'Files below the chunking threshold (16 MiB by default) skip the assemble step. Files queue one after another; parts of one file go in parallel',
    },
  },
  /**
   * plugin/notification/service/notification_service.py 的 create_in_tx（站内行 + 投递行，同一事务）→
   * routing.resolve（系统策略 × 个人偏好 → _skip_reason）→ delivery_service（worker 抢占、退避重试、unknown 不重试）
   */
  notify: {
    zh: {
      steps: [
        { name: '业务事务里写入', sub: '站内消息和投递行一起写', branch: { when: '事务回滚', name: '什么都不发', sub: '邮件不会先于业务到' } },
        { name: '站内消息', sub: '铃铛实时亮起，永远发' },
        { name: '选渠道', sub: '系统策略 × 个人偏好', branch: { when: '没开', name: '不走这条渠道', sub: '不留记录' } },
        { name: '查收件人', sub: '账号状态 · 地址 · 手机号已验证', branch: { when: '不满足', name: '记为「跳过」', sub: '投递记录里写原因' } },
        { name: 'worker 发送', sub: '提交后立刻踢一次，另每 15 秒扫', branch: { when: '失败', name: '退避重试 4 次', sub: '可能已发出的不重试' } },
      ],
      end: { name: '已发出', sub: '邮件服务器 / 厂商已受理' },
      caption: '对每个收件人 × 每条外部渠道（邮件、短信）各走一遍；群机器人按「一条通知 × 一个机器人」一行。全员广播的类型只发站内',
    },
    en: {
      steps: [
        { name: 'Written in your transaction', sub: 'In-app row and delivery rows together', branch: { when: 'Rolled back', name: 'Nothing is sent', sub: 'No email before the change commits' } },
        { name: 'In-app message', sub: 'The bell lights up; always sent' },
        { name: 'Pick channels', sub: 'System policy × personal preference', branch: { when: 'Off', name: 'Channel not used', sub: 'No row recorded' } },
        { name: 'Check recipient', sub: 'Account status · address · verified phone', branch: { when: 'Not met', name: 'Recorded as skipped', sub: 'Reason shown in delivery records' } },
        { name: 'Worker sends', sub: 'Kicked on commit, plus a 15 s sweep', branch: { when: 'Fails', name: 'Backoff, 4 retries', sub: 'Maybe-sent results are not retried' } },
      ],
      end: { name: 'Sent', sub: 'Accepted by the mail server / provider' },
      caption: 'Runs once per recipient × external channel (email, SMS); group bots get one row per notification × bot. Broadcast types are in-app only',
    },
  },
  /**
   * common/security/rbac.py 的 rbac_verify（超管放行 · 角色 / 菜单 · 非 GET 要 is_staff · 权限码）→
   * permission.py 的 filter_data_permission_for_user（超管 / 有角色关过滤 → 不过滤；开了过滤没规则 → 一行不给；规则读不懂 → false()）
   * → data_scope.py 的 DataScopedCRUD 在 select / select_model / count 上拼条件
   */
  dataScope: {
    zh: {
      steps: [
        { name: '登录校验', sub: '解出当前用户' },
        { name: '功能权限', sub: '接口要求的权限码', branch: { when: '没有', name: '403', sub: '这一步就拦下' } },
        { name: '要不要过滤', sub: '超管 · 有角色关了过滤', branch: { when: '是', name: '不过滤', sub: '看到全部行', tone: 'ok' as const } },
        { name: '收集规则', sub: '所有启用角色 × 启用范围', branch: { when: '一条都没有', name: '一行都看不到', sub: '开了过滤就得配规则' } },
        { name: '编译成条件', sub: 'AND 求交，再和 OR 求并', branch: { when: '有规则读不懂', name: '一行都看不到', sub: '宁可收紧也不放开' } },
      ],
      end: { name: '返回范围内的行', sub: '列表 · 详情 · 计数都套上' },
      caption: '前两步按接口判，后三步按查询判：同一个人调同一个接口，查用户表和查部门表套上的条件可以不一样',
    },
    en: {
      steps: [
        { name: 'Sign-in check', sub: 'Resolve the current user' },
        { name: 'Function permission', sub: 'The code the API requires', branch: { when: 'Missing', name: '403', sub: 'Stopped right here' } },
        { name: 'Filter at all?', sub: 'Superuser · a role with filtering off', branch: { when: 'Yes', name: 'No filter', sub: 'Every row', tone: 'ok' as const } },
        { name: 'Collect rules', sub: 'All enabled roles × enabled scopes', branch: { when: 'None', name: 'No rows at all', sub: 'Filtering on needs rules' } },
        { name: 'Compile', sub: 'AND rules intersect, then union with OR', branch: { when: 'A rule is invalid', name: 'No rows at all', sub: 'Fails closed, never open' } },
      ],
      end: { name: 'Rows in scope', sub: 'Lists, details and counts' },
      caption: 'The first two steps are per API, the last three per query: the same person on the same API can get different conditions on users and on departments',
    },
  },
  /**
   * app/task：scheduler_service（写表后在 Redis 打变更标记）→ utils/schedulers.py（beat 每拍看标记重读、按 DATETIME_TIMEZONE 墙上时间）
   * → broker（CELERY_BROKER_REDIS_DATABASE）→ worker（未注册的任务只记一条 Received unregistered task，不产生执行记录）→ with_timeout
   */
  scheduler: {
    zh: {
      steps: [
        { name: '界面保存', sub: '写进数据库，通知 beat 重读' },
        { name: 'beat 到点派发', sub: '按服务器时区的本地时间', branch: { when: 'beat 没起', name: '永远不触发', sub: '配置照样能保存' } },
        { name: '进入队列', sub: 'Redis 1 号库（可改）', branch: { when: '库号被别的项目占用', name: '任务被别人取走', sub: '两边互相抢' } },
        { name: 'worker 接单', sub: '按任务名找代码', branch: { when: '任务没注册', name: '直接丢弃', sub: '列表上这一行标红' } },
        { name: '执行', sub: '默认最长 30 分钟', branch: { when: '出错 · 超时', name: '记为失败', sub: '异常栈在执行记录里' } },
      ],
      end: { name: '执行记录', sub: '状态 · 返回值 · 哪个 worker' },
      caption: '每 60 秒及更频繁的内置任务（心跳、投递、公告对时）刻意不写执行记录，否则一天几千行',
    },
    en: {
      steps: [
        { name: 'Saved in the UI', sub: 'Written to the database; beat is told to reload' },
        { name: 'Beat fires on time', sub: "In the server's local time zone", branch: { when: 'Beat not running', name: 'Never fires', sub: 'Saving still works' } },
        { name: 'Queued', sub: 'Redis database 1 (configurable)', branch: { when: 'DB shared with another project', name: 'Taken by them', sub: 'Both sides steal tasks' } },
        { name: 'Worker picks up', sub: 'Looks the task up by name', branch: { when: 'Not registered', name: 'Dropped', sub: 'The row is flagged red' } },
        { name: 'Runs', sub: '30 minutes max by default', branch: { when: 'Error · timeout', name: 'Recorded as failed', sub: 'Traceback in the record' } },
      ],
      end: { name: 'Run record', sub: 'Status · result · which worker' },
      caption: 'Built-in tasks running every 60 s or more often (heartbeat, deliveries, notice sync) deliberately write no run records — otherwise thousands a day',
    },
  },
  /**
   * common/dataio/importing.py + app/admin/service/import_service.py：template → preview（utils/excel_ops 解析，整份文件级的错直接拒）
   * → commit（一次性令牌 IMPORT_EXPIRE_SECONDS，提交时按库的最新状态重校验，部门按层级写，all_or_nothing 时整批回滚）
   */
  dataImport: {
    zh: {
      steps: [
        { name: '下载模板', sub: '带下拉选项和「说明」页' },
        { name: '上传检查', sub: '只收 xlsx · 5 MB · 1000 行 · 表头', branch: { when: '不通过', name: '整个文件拒收', sub: '提示哪里不对' } },
        { name: '逐行预览', sub: '一行都不写，算出新增 / 更新', branch: { when: '有问题的行', name: '标出原因', sub: '可以先排除再提交' } },
        { name: '提交', sub: '30 分钟内，按库里最新状态再校验', branch: { when: '超时 · 重复提交', name: '令牌失效', sub: '重新上传预览' } },
        { name: '写入', sub: '部门按层级先建上级', branch: { when: '有行失败', name: '跳过这几行', sub: '勾了「全部成功才导入」则整批回滚' } },
      ],
      end: { name: '导入完成', sub: '失败的行可下载错误报告' },
      caption: '错误报告是原表加「行号」「原因」两列，改完直接重新导入',
    },
    en: {
      steps: [
        { name: 'Download template', sub: 'With dropdowns and a notes sheet' },
        { name: 'Upload checks', sub: 'xlsx only · 5 MB · 1000 rows · headers', branch: { when: 'Fails', name: 'Whole file refused', sub: 'The message says why' } },
        { name: 'Row-by-row preview', sub: 'Nothing written; counts creates / updates', branch: { when: 'Bad rows', name: 'Reason per row', sub: 'Exclude them before committing' } },
        { name: 'Commit', sub: 'Within 30 min, rechecked against the database', branch: { when: 'Expired · reused', name: 'Token invalid', sub: 'Upload and preview again' } },
        { name: 'Write', sub: 'Departments parent-first', branch: { when: 'Some rows fail', name: 'Those rows skipped', sub: 'Or the whole batch rolls back if all-or-nothing is on' } },
      ],
      end: { name: 'Done', sub: 'Failed rows: download the error report' },
      caption: 'The error report is your file plus "row" and "reason" columns — fix it and import it again',
    },
  },
  /** plugin/open/gateway/auth.py 模块头的八步检查（顺序与代码一致）；先验签后消费 nonce */
  openApi: {
    zh: {
      steps: [
        { name: '请求头', sub: 'AK · 时间戳 · nonce · 签名', branch: { when: '缺', name: '400', sub: '列出缺哪几个' } },
        { name: '认应用', sub: 'AK 有效 · 启用 · 未过期', branch: { when: '不对', name: '401', sub: 'AK 无效 / 停用 / 过期' } },
        { name: 'IP 白名单', sub: '留空 = 不限', branch: { when: '不在', name: '403', sub: '回带看到的 IP' } },
        { name: '时间与签名', sub: '±300 秒 · HMAC-SHA256', branch: { when: '对不上', name: '401', sub: '回带服务端拼的待签名串' } },
        { name: '防重放', sub: 'nonce 600 秒内不能再用', branch: { when: '用过', name: '401', sub: '疑似重放' } },
        { name: '授权与限流', sub: 'scope · 每分钟次数', branch: { when: '超出', name: '403 / 429', sub: '429 带 Retry-After' } },
      ],
      end: { name: '返回数据', sub: '成功失败都记调用日志' },
      caption: '签名不对的请求不占用 nonce：修好签名后用同一个 nonce 重发，不会被当成重放',
    },
    en: {
      steps: [
        { name: 'Headers', sub: 'AK · timestamp · nonce · sign', branch: { when: 'Missing', name: '400', sub: 'Lists which ones' } },
        { name: 'App', sub: 'AK valid · enabled · not expired', branch: { when: 'Bad', name: '401', sub: 'Invalid / disabled / expired' } },
        { name: 'IP allowlist', sub: 'Empty = any', branch: { when: 'Not listed', name: '403', sub: 'Echoes the IP seen' } },
        { name: 'Time & signature', sub: '±300 s · HMAC-SHA256', branch: { when: 'Mismatch', name: '401', sub: "Echoes the server's string to sign" } },
        { name: 'Replay', sub: 'A nonce lives 600 s', branch: { when: 'Reused', name: '401', sub: 'Looks like a replay' } },
        { name: 'Scope & rate', sub: 'Granted scope · per-minute limit', branch: { when: 'Exceeded', name: '403 / 429', sub: '429 has Retry-After' } },
      ],
      end: { name: 'Data returned', sub: 'Every call is logged' },
      caption: 'A request with a bad signature does not burn its nonce: fix the signature and resend with the same nonce, and it is not treated as a replay',
    },
  },
  /**
   * 每个请求：common/security/jwt.py 的 get_current_user（账号 status → 部门 status → 角色全停）
   * → rbac.py 的 rbac_verify（有启用角色 → 角色挂了菜单 → 非 GET 要 is_staff → 接口权限码）；超管在 rbac_verify 第一步放行
   */
  account: {
    zh: {
      steps: [
        { name: '账号', sub: '状态是「正常」', branch: { when: '停用', name: '拒绝', sub: '用户已被锁定' } },
        { name: '部门', sub: '所属部门启用', branch: { when: '停用', name: '拒绝', sub: '所属部门已被锁定' } },
        { name: '角色', sub: '至少一个启用的角色', branch: { when: '没有', name: '拒绝', sub: '所属角色已被锁定' } },
        { name: '菜单', sub: '角色至少勾了一个菜单', branch: { when: '一个没勾', name: '拒绝', sub: '用户未分配菜单' } },
        { name: '写操作', sub: '新增 / 修改 / 删除要「后台登录」', branch: { when: '开关关着', name: '只能看', sub: '禁止后台管理操作' } },
        { name: '权限码', sub: '接口要的码在某个角色的菜单里', branch: { when: '没有', name: '403', sub: '' } },
      ],
      end: { name: '放行', sub: '再按数据范围过滤行' },
      caption: '超级管理员跳过最后三步。前三步在每个请求解析登录身份时就判，所以停用部门或角色，正在用的人下一个请求就被拒',
    },
    en: {
      steps: [
        { name: 'Account', sub: 'Status is active', branch: { when: 'Disabled', name: 'Refused', sub: 'Account is locked' } },
        { name: 'Department', sub: 'Its department is enabled', branch: { when: 'Disabled', name: 'Refused', sub: 'Department disabled' } },
        { name: 'Roles', sub: 'At least one enabled role', branch: { when: 'None', name: 'Refused', sub: 'Role disabled' } },
        { name: 'Menus', sub: 'The roles tick at least one menu', branch: { when: 'None', name: 'Refused', sub: 'No menu assigned' } },
        { name: 'Writes', sub: 'Create / update / delete need Admin sign-in', branch: { when: 'Switch off', name: 'Read-only', sub: 'Admin operations refused' } },
        { name: 'Permission code', sub: "The API's code is in one of the roles' menus", branch: { when: 'Missing', name: '403', sub: '' } },
      ],
      end: { name: 'Allowed', sub: 'Rows then filtered by data scope' },
      caption: 'Superusers skip the last three steps. The first three run whenever a request resolves who is signed in, so disabling a department or role refuses its users on their very next request',
    },
  },
  /**
   * common/data_change/capture.py（会话 before_flush / 提交前比对，和业务同一事务写入）→ chain.py（编号 + HMAC 连上一条）
   * → middleware/opera_log_middleware.py（响应之后打码、入队，put_nowait 满了丢弃）；两边靠 trace_id 关联
   */
  audit: {
    zh: {
      steps: [
        { name: '请求进来', sub: '分配一个 trace_id' },
        { name: '业务改数据', sub: '会话记下改了哪些对象', branch: { when: '事务回滚', name: '不留变更记录', sub: '和业务数据同进同退' } },
        { name: '提交前比对', sub: '字段 · 旧值 · 新值，敏感字段只记「改了」' },
        { name: '签名入链', sub: '编号，签名里带上一条的签名' },
        { name: '写操作日志', sub: '响应之后打码、排队写入', branch: { when: '队列满', name: '丢弃这一条', sub: '打警告日志' } },
      ],
      end: { name: '两条记录互跳', sub: '同一个 trace_id' },
      caption: '登录日志是另一条路：每次登录尝试和锁定、强制下线这类安全事件，在登录接口里直接写',
    },
    en: {
      steps: [
        { name: 'Request in', sub: 'Gets a trace_id' },
        { name: 'Data changes', sub: 'The session notes changed objects', branch: { when: 'Rolled back', name: 'No change record', sub: 'Lives and dies with the data' } },
        { name: 'Diff before commit', sub: 'Field · old · new; sensitive fields only "changed"' },
        { name: 'Signed into the chain', sub: "Numbered; signature includes the previous one's" },
        { name: 'Operation log', sub: 'After the response: redacted, queued', branch: { when: 'Queue full', name: 'This entry dropped', sub: 'A warning is logged' } },
      ],
      end: { name: 'Linked both ways', sub: 'Same trace_id' },
      caption: 'Login logs take a separate path: every sign-in attempt and security events like lockouts and forced sign-outs are written by the sign-in API itself',
    },
  },
  /**
   * plugin/installer.py（zip / git，开发环境才放行；页面安装不跑 SQL）→ plugin/core.py 启动时 parse_plugin_config / resolve_plugin_order
   * （缺 plugin.toml、依赖缺失或成环抛 PluginInjectError / PluginConfigError，后端起不来）→ router.py 注入 → status.py 每个请求查启停
   */
  plugin: {
    zh: {
      steps: [
        { name: '放进目录', sub: 'fba add 或插件管理页，只限开发环境', branch: { when: '包不合法', name: '拒绝安装', sub: '缺 plugin.toml / README' } },
        { name: '建表与初始化', sub: '只有命令行安装会做', branch: { when: '从页面装的', name: '没有表', sub: '要再跑一次命令行' } },
        { name: '重启后端', sub: '校验 plugin.toml、按依赖排序', branch: { when: '依赖缺失或成环', name: '后端起不来', sub: '启动日志写着原因' } },
        { name: '挂路由与扩展点', sub: '通知类型 · 导入导出 · AI 工具…' },
        { name: '每个请求查启停', sub: '状态存在 Redis', branch: { when: '停用', name: '接口报未启用', sub: '菜单照常显示' } },
      ],
      end: { name: '可以使用', sub: '前端页面要另外接' },
      caption: '启停在页面上切换立即生效；安装、卸载、改 plugin.toml 都要重启后端',
    },
    en: {
      steps: [
        { name: 'Into the directory', sub: 'fba add or the plugin page, development only', branch: { when: 'Bad package', name: 'Install refused', sub: 'No plugin.toml / README' } },
        { name: 'Tables & seed SQL', sub: 'Only the command line does this', branch: { when: 'Installed from the page', name: 'No tables', sub: 'Run the command line too' } },
        { name: 'Restart backend', sub: 'Validates plugin.toml, orders by dependency', branch: { when: 'Missing or cyclic deps', name: "Backend won't start", sub: 'The startup log says why' } },
        { name: 'Routes & extension points', sub: 'Notification kinds · import/export · AI tools…' },
        { name: 'Per-request status check', sub: 'Status lives in Redis', branch: { when: 'Disabled', name: 'API says not enabled', sub: 'Menus still show' } },
      ],
      end: { name: 'Ready', sub: 'Frontend pages are wired separately' },
      caption: 'Enabling and disabling on the page apply at once; installing, uninstalling or editing plugin.toml needs a backend restart',
    },
  },
  /**
   * plugin/config/service（写入走 check_dynamic_int_bounds / DYNAMIC_CHOICES，提交后清缓存）→
   * utils/dynamic_config.py 的 load_*（组总开关 <组>_CONFIG_STATUS 为 0 时回落 _ENV_DEFAULTS；读到不合法的值按键回落并记 error）
   */
  config: {
    zh: {
      steps: [
        { name: '界面保存', sub: '后端按范围校验', branch: { when: '超出范围', name: '拒绝保存', sub: '提示允许的范围' } },
        { name: '用到时读库', sub: '不缓存旧值，不用重启' },
        { name: '看组总开关', sub: '每组一个 _CONFIG_STATUS', branch: { when: '关着', name: '整组用 .env', sub: '库里的值不读' } },
        { name: '逐项取值', sub: '库里的值覆盖 .env', branch: { when: '库里的值不合法', name: '这一项用 .env', sub: '记一条错误日志' } },
      ],
      end: { name: '新值生效', sub: '会话 / 上传只管之后的' },
      caption: '会话策略只影响之后的登录，已登录的人按登录时的规则走完；文件上传只影响之后开始的上传',
    },
    en: {
      steps: [
        { name: 'Saved in the UI', sub: 'Range-checked by the backend', branch: { when: 'Out of range', name: 'Refused', sub: 'Message gives the range' } },
        { name: 'Read when used', sub: 'No stale cache, no restart' },
        { name: 'Group switch', sub: 'One _CONFIG_STATUS per group', branch: { when: 'Off', name: 'Whole group from .env', sub: 'Database values ignored' } },
        { name: 'Per key', sub: 'Database value overrides .env', branch: { when: 'Invalid value', name: 'That key from .env', sub: 'An error is logged' } },
      ],
      end: { name: 'New value in effect', sub: 'Sessions / uploads: from now on' },
      caption: 'Session policy only affects later sign-ins — people already signed in keep the rules they signed in under; upload settings only affect uploads started afterwards',
    },
  },
  /**
   * common/security/session.py：登录准入（按端的上限，挤掉最久没活跃的 / 拒绝）→ 每个请求 check（已结束带原因 401）
   * → 空闲按 X-Client-Idle 推算的最后活跃判 → refresh 轮换（30 秒宽限回放、期外判 reuse 撤销整个会话）→ 绝对到期
   */
  session: {
    zh: {
      steps: [
        { name: '登录', sub: '建会话，查这一端的上限', branch: { when: '满了', name: '挤掉最久没活跃的', sub: '或按设置拒绝新登录' } },
        { name: '每个请求', sub: '核对会话还在不在', branch: { when: '已结束', name: '回到登录页', sub: '显示被踢的原因' } },
        { name: '空闲检查', sub: '按人有没有在操作算', branch: { when: '超过空闲时长', name: '自动退出', sub: '后台轮询不算操作' } },
        { name: '续期', sub: 'access 30 分钟，refresh 每次换新', branch: { when: '旧 refresh 30 秒后再用', name: '整个会话作废', sub: '疑似凭据被盗' } },
        { name: '最长登录', sub: '从登录那一刻算', branch: { when: '到期', name: '要求重新登录', sub: '一直在用也不延长' } },
      ],
      end: { name: '继续使用', sub: '在线用户页可见' },
      caption: '管理员强制下线、改密码、停用账号随时结束会话；有实时连接的页面当场回到登录页',
    },
    en: {
      steps: [
        { name: 'Sign in', sub: "Session created; this client's limit checked", branch: { when: 'Full', name: 'Oldest idle one out', sub: 'Or refuse, if so configured' } },
        { name: 'Every request', sub: 'Is the session still there?', branch: { when: 'Ended', name: 'Back to sign-in', sub: 'With the reason' } },
        { name: 'Idle check', sub: 'Counts human activity', branch: { when: 'Idle too long', name: 'Signed out', sub: "Background polling doesn't count" } },
        { name: 'Renewal', sub: 'Access 30 min; refresh rotates', branch: { when: 'Old refresh reused after 30 s', name: 'Session revoked', sub: 'Possible stolen token' } },
        { name: 'Max lifetime', sub: 'Counted from sign-in', branch: { when: 'Reached', name: 'Sign in again', sub: 'Activity never extends it' } },
      ],
      end: { name: 'Carry on', sub: 'Visible under Online users' },
      caption: 'Admin sign-outs, password changes and disabled accounts end sessions at any time; pages with a live connection return to sign-in immediately',
    },
  },
  /**
   * app/task/utils/schedulers.py 的 tick（调度器心跳）→ health.heartbeat 任务（worker 心跳）→ core/registrar.py 的 /api/health/status
   * （并发查 DB / Redis / 两个心跳；超过 HEARTBEAT_MAX_AGE_SECONDS 记 stale、没写过记 missing、调度器不正常时 worker 记 unknown）
   */
  health: {
    zh: {
      steps: [
        { name: 'beat 每一拍', sub: '写调度器心跳', branch: { when: 'beat 没起', name: '调度器异常', sub: 'worker 也无从判断（unknown）' } },
        { name: '派心跳任务', sub: '每 60 秒一个 health.heartbeat' },
        { name: 'worker 执行', sub: '写 worker 心跳', branch: { when: 'worker 没起', name: 'worker 过期', sub: '180 秒没更新（stale）' } },
        { name: '健康检查', sub: '同时查数据库 · Redis · 两个心跳', branch: { when: '任一异常', name: '503', sub: '逐项列出状态' } },
      ],
      end: { name: '200', sub: '五项都是 ok' },
      caption: '后端进程整个挂了时由 nginx 直接回 503 和 {"status":"unavailable"}，并带 Retry-After: 15',
    },
    en: {
      steps: [
        { name: 'Every beat tick', sub: 'Writes the scheduler heartbeat', branch: { when: 'Beat down', name: 'Scheduler failing', sub: "Worker can't be judged (unknown)" } },
        { name: 'Heartbeat task', sub: 'A health.heartbeat every 60 s' },
        { name: 'Worker runs it', sub: 'Writes the worker heartbeat', branch: { when: 'Worker down', name: 'Worker stale', sub: 'No update for 180 s' } },
        { name: 'Health check', sub: 'DB · Redis · both heartbeats at once', branch: { when: 'Any failing', name: '503', sub: 'Each item listed' } },
      ],
      end: { name: '200', sub: 'All five ok' },
      caption: 'If the backend process is down entirely, nginx answers 503 with {"status":"unavailable"} and Retry-After: 15',
    },
  },
  /**
   * packages/platform/src/pages/dashboard：index.tsx 读 /me/preferences/dashboard.layout（失败 → 默认布局 + 禁止编辑）
   * → layout.ts 的兼容规则（认不出的卡片忽略、新卡片排最后、整份认不出回落默认并提示）→ cards/registry.ts 的 available 按权限过滤
   */
  dashboard: {
    zh: {
      steps: [
        { name: '读你的布局', sub: '存在服务端，跨设备同一份', branch: { when: '读取失败', name: '先用默认布局', sub: '读到之前不能编辑' } },
        { name: '兼容旧布局', sub: '新卡片排最后，认不出的忽略', branch: { when: '整份认不出', name: '用默认布局', sub: '顶部提示，保存一次即覆盖' } },
        { name: '按权限过滤', sub: '每张卡片和它的接口同一套条件', branch: { when: '没有权限', name: '这张卡片不出现', sub: '不画无权限的空壳' } },
        { name: '各卡片取数', sub: '每张卡片一个接口', branch: { when: '某个接口失败', name: '只有这张报错', sub: '带重试，别的照常' } },
      ],
      end: { name: '你的工作台', sub: '「自定义」随时改' },
      caption: '外观（主题色、圆角、密度、页签样式）存在浏览器本地，不跟账号走；只有工作台布局和时区存在服务端',
    },
    en: {
      steps: [
        { name: 'Load your layout', sub: 'Stored on the server, same on every device', branch: { when: 'Load fails', name: 'Default layout for now', sub: 'No editing until it loads' } },
        { name: 'Upgrade old layout', sub: 'New cards go last, unknown ones are ignored', branch: { when: 'Unreadable', name: 'Default layout', sub: 'A notice; saving once replaces it' } },
        { name: 'Permission filter', sub: 'Each card uses its API’s own rule', branch: { when: 'No permission', name: 'Card not shown', sub: 'No empty "no access" shells' } },
        { name: 'Cards fetch data', sub: 'One API per card', branch: { when: 'One API fails', name: 'Only that card errors', sub: 'With retry; the rest work' } },
      ],
      end: { name: 'Your dashboard', sub: 'Change it any time with Custom' },
      caption: 'Appearance (theme colour, radius, density, tab style) is stored in the browser and does not follow the account; only the dashboard layout and time zone live on the server',
    },
  },
  /**
   * packages/platform/src/shell：tab-store.ts open()（key = routeId + params，MAX_TABS 20，pickVictim 淘汰 lastUsed 最小的非固定页签）
   * → tab-outlet.tsx 每页一个 <Activity>（hidden 保留 DOM 与 state、销毁 effect）· 每页一道 TabErrorBoundary
   * → sessionStorage admin:tabs 存 href 与 search，刷新后按它恢复；内存状态不恢复
   */
  tabs: {
    zh: {
      steps: [
        { name: '打开页面', sub: '同一个页面只开一个页签', branch: { when: '已满 20 个', name: '关掉最久没用的', sub: '固定的页签不会被关' } },
        { name: '切到别处', sub: '页面藏起来，不卸载', branch: { when: '这一页出错', name: '只换掉这一页', sub: '别的页签不受影响' } },
        { name: '切回来', sub: '表单、展开、滚动原样都在' },
        { name: '刷新浏览器', sub: '内存清空', branch: { when: '没提交的输入', name: '丢失', sub: '刷新前先保存' } },
      ],
      end: { name: '按地址恢复', sub: '每个页签带着筛选和分页回来' },
      caption: '后台页签的轮询、定时器会暂停，切回来再继续；后台请求返回时不会把你拽回那一页',
    },
    en: {
      steps: [
        { name: 'Open a page', sub: 'One tab per page', branch: { when: 'Already 20', name: 'Least recently used closes', sub: 'Pinned tabs never do' } },
        { name: 'Switch away', sub: 'The page is hidden, not unmounted', branch: { when: 'This page crashes', name: 'Only it is replaced', sub: 'Other tabs are fine' } },
        { name: 'Switch back', sub: 'Forms, expansion and scroll intact' },
        { name: 'Browser refresh', sub: 'Memory is cleared', branch: { when: 'Unsaved input', name: 'Lost', sub: 'Save before refreshing' } },
      ],
      end: { name: 'Restored from URLs', sub: 'Each tab returns with its filters and page' },
      caption: "Background tabs pause polling and timers until you return; a request finishing in a background tab never pulls you back to it",
    },
  },
  /**
   * packages/api/scripts/gen.mjs（import 后端应用取 OpenAPI，离线）→ schema.d.ts → 移动端按它推断类型、网页端 api.GET<T>(string) 手写
   * → CI：typecheck · lint · arch:check · i18n:check · ctx:check（根 CLAUDE.md 硬纪律 12 / 13）
   */
  contract: {
    zh: {
      steps: [
        { name: '改后端接口', sub: '字段 · 路径 · 参数' },
        { name: '生成契约', sub: 'pnpm --filter @admin/api gen:api', branch: { when: '忘了跑', name: '类型还是旧的', sub: '检查不出问题' } },
        { name: '类型检查', sub: 'pnpm typecheck --force', branch: { when: '网页端调用', name: '查不出来', sub: '返回类型是手写的' } },
        { name: '其余闸门', sub: 'lint · arch · i18n · ctx', branch: { when: '有一项不过', name: 'CI 变红', sub: '本地先跑一遍' } },
      ],
      end: { name: '可以合并', sub: '移动端已被类型兜住' },
      caption: '不加 --force 时，turbo 缓存命中会打印上一次的结果：可能报一个早已修掉的错，也可能漏掉新错',
    },
    en: {
      steps: [
        { name: 'Change an API', sub: 'Fields · paths · parameters' },
        { name: 'Generate contract', sub: 'pnpm --filter @admin/api gen:api', branch: { when: 'Forgotten', name: 'Types stay stale', sub: 'Nothing gets flagged' } },
        { name: 'Type check', sub: 'pnpm typecheck --force', branch: { when: 'Web calls', name: 'Not caught', sub: 'Return types are hand-written' } },
        { name: 'Other gates', sub: 'lint · arch · i18n · ctx', branch: { when: 'Any fails', name: 'CI goes red', sub: 'Run them locally first' } },
      ],
      end: { name: 'Ready to merge', sub: 'Mobile is covered by types' },
      caption: 'Without --force, a turbo cache hit prints the previous run: it may report an error fixed long ago, or miss a new one',
    },
  },
}
