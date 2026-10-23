import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exampleBrief, validateBrief } from './demo-planner.ts'

test('accepts an extracted attachment and rejects oversized or malformed model context', () => {
  const valid = { ...exampleBrief, attachments: [{ name: '产品资料.pdf', text: '产品信息：低糖冷萃', truncated: false }] }
  assert.equal(validateBrief(valid), true)
  assert.equal(validateBrief({ ...valid, attachments: [{ ...valid.attachments[0], text: '字'.repeat(10_001) }] }), false)
  assert.equal(validateBrief({ ...valid, attachments: Array(5).fill(valid.attachments[0]) }), false)
  assert.equal(validateBrief({ ...valid, attachments: [{ name: '资料.pdf', text: '', truncated: false }] }), false)
})
