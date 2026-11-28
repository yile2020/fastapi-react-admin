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
}
