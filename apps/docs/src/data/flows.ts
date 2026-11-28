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
}
