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
}
