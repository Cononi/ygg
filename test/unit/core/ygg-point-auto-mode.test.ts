import { describe, expect, it } from 'vitest'

import { createStageDefinition } from '../../../src/core/dimensions/create.js'
import { DEFAULT_YGG_POINT_AUTO_MODE, YggPointEngine, isYggPointAutoModeEnabled, resolveYggPointAutoMode } from '../../../src/core/ygg-point.js'

describe('ygg point auto mode', () => {
  it('defaults to off when config is missing', () => {
    expect(DEFAULT_YGG_POINT_AUTO_MODE).toBe('off')
    expect(resolveYggPointAutoMode(undefined)).toBe('off')
    expect(resolveYggPointAutoMode(null)).toBe('off')
  })

  it('treats only on as enabled', () => {
    expect(resolveYggPointAutoMode('on')).toBe('on')
    expect(isYggPointAutoModeEnabled('on')).toBe(true)
    expect(isYggPointAutoModeEnabled('off')).toBe(false)
  })

  it('keeps auto-verifiable questions unanswered when auto mode is off', () => {
    const engine = new YggPointEngine(createStageDefinition)
    const input = [
      '왜 필요한가: proposal 점수 흐름을 더 정확히 보여줘야 한다.',
      '범위: create 단계의 점수 계산과 proposal 생성 흐름.',
      '사용자: ygg 워크플로우를 처음 사용하는 개발자와 유지보수자.',
      '제외: add/qa 단계의 동작 변경은 하지 않는다.',
      '영향: src/core/ygg-point.ts 와 create skill 문서.',
    ].join('\n')

    const { result, autoAnswersAdded } = engine.runQuestionLoop(input, { autoMode: 'off' })

    expect(autoAnswersAdded).toBe(0)
    expect(result.history).toHaveLength(0)
    expect(result.ready).toBe(false)
  })

  it('auto-answers auto-verifiable evaluators when auto mode is on', () => {
    const engine = new YggPointEngine(createStageDefinition)
    const input = [
      '왜 필요한가: proposal 점수 흐름을 더 정확히 보여줘야 한다.',
      '범위: create 단계의 점수 계산과 proposal 생성 흐름.',
      '사용자: ygg 워크플로우를 처음 사용하는 개발자와 유지보수자.',
      '제외: add/qa 단계의 동작 변경은 하지 않는다.',
      '영향: src/core/ygg-point.ts 와 create skill 문서.',
    ].join('\n')

    const offResult = new YggPointEngine(createStageDefinition).runQuestionLoop(input, { autoMode: 'off' })
    const { result, autoAnswersAdded } = engine.runQuestionLoop(input, { autoMode: 'on' })

    expect(autoAnswersAdded).toBeGreaterThan(0)
    expect(result.history.length).toBe(autoAnswersAdded)
    expect(result.history.every((entry) => entry.answerSource === 'auto')).toBe(true)
    expect(result.score).toBeGreaterThan(offResult.result.score)
    expect(result.nextQuestions.length).toBeGreaterThan(0)
    expect(result.nextQuestions.every((question) => question.evaluatorType !== 'reference' && question.evaluatorType !== 'consistency')).toBe(true)
  })
})
