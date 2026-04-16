import { describe, expect, it } from 'vitest'

import { createStageDefinition } from '../../../src/core/dimensions/create.js'
import { nextStageDefinition } from '../../../src/core/dimensions/next.js'
import { createYggPointDocument } from '../../../src/core/ygg-point.js'
import type { QAEntry } from '../../../src/types/ygg-point.js'

describe('createYggPointDocument', () => {
  it('builds a deterministic standard ygg-point document with dimension trail details only', () => {
    const history: QAEntry[] = [
      {
        dimension: 'motivation',
        evaluatorType: 'base',
        question: '이번 변경이 꼭 필요한 이유를 한 문장으로 정의해주세요. 지금 무엇이 막히고 있고, 바뀐 뒤 무엇이 달라져야 하나요?',
        answer: '사용자가 점수 상승 이유를 이해할 수 있어야 합니다.',
        timestamp: '2026-04-15T00:00:00.000Z',
      },
      {
        dimension: 'scope',
        evaluatorType: 'humanistic',
        question: '이 변경 후 사용자가 직접 체감해야 하는 변화는 무엇인가요? UI, 워크플로우, 응답성 중 바뀌는 지점을 구체적으로 적어주세요.',
        answer: '대시보드에서 프로젝트 간 ygg-point 비교가 쉬워집니다.',
        timestamp: '2026-04-15T00:01:00.000Z',
      },
    ]

    const input = [
      '왜 필요한가: ygg-point 구조가 프로젝트마다 달라 비교가 어렵다.',
      '범위: ygg-point json 생성 구조와 topic detail 표시를 표준화한다.',
      '사용자: dashboard completed 목록에서 비교하는 사용자.',
      '제외: 계산식 자체 변경은 하지 않는다.',
      '영향: src/core/ygg-point.ts, TopicDetail.tsx.',
    ].join('\n')

    const document = createYggPointDocument({
      topic: 'standard-ygg-point',
      date: '2026-04-15',
      archiveType: 'feat',
      currentStage: 'create',
      stageDef: createStageDefinition,
      userInput: input,
      history,
    })

    expect(document.schemaVersion).toBe('2.0')
    expect(document.currentStage).toBe('create')
    expect(document.archiveType).toBe('feat')
    expect(document.requestText).toBeUndefined()
    expect(document.stages.create).toBeDefined()
    expect(document.stages.create?.improvementSummary).toContain('2개 질문 응답')
    expect(document.history).toBeUndefined()
    expect(document.stages.create?.dimensions.motivation?.description).toBe('왜 이 변경이 필요한지 — 동기와 배경의 명확성')
    expect(document.stages.create?.dimensions.motivation?.rationale).toContain('기본 충실도')
    expect(document.stages.create?.dimensions.motivation?.questionTrail).toHaveLength(1)
    expect(document.stages.create?.dimensions.motivation?.questionTrail[0]).toMatchObject({
      round: 1,
      question: '이번 변경이 꼭 필요한 이유를 한 문장으로 정의해주세요. 지금 무엇이 막히고 있고, 바뀐 뒤 무엇이 달라져야 하나요?',
      answer: '사용자가 점수 상승 이유를 이해할 수 있어야 합니다.',
      evaluatorType: 'base',
      timestamp: '2026-04-15T00:00:00.000Z',
    })
    expect(document.stages.create?.dimensions.motivation?.questionTrail[0]?.scoreAfter).toBeGreaterThan(
      document.stages.create?.dimensions.motivation?.questionTrail[0]?.scoreBefore ?? 0,
    )
    expect(document.stages.create?.dimensions.scope?.questionTrail).toHaveLength(1)
    expect(document.stages.create?.dimensions.scope?.questionTrail[0]).toMatchObject({
      round: 1,
      question: '이 변경 후 사용자가 직접 체감해야 하는 변화는 무엇인가요? UI, 워크플로우, 응답성 중 바뀌는 지점을 구체적으로 적어주세요.',
      answer: '대시보드에서 프로젝트 간 ygg-point 비교가 쉬워집니다.',
      evaluatorType: 'humanistic',
      timestamp: '2026-04-15T00:01:00.000Z',
    })
    expect(document.stages.create?.dimensions.scope?.questionTrail[0]?.scoreAfter).toBeGreaterThan(
      document.stages.create?.dimensions.scope?.questionTrail[0]?.scoreBefore ?? 0,
    )
  })

  it('preserves question trails beyond five answered rounds', () => {
    const history: QAEntry[] = [
      {
        dimension: 'motivation',
        evaluatorType: 'base',
        question: 'q1',
        answer: 'a1',
        timestamp: '2026-04-15T00:00:00.000Z',
      },
      {
        dimension: 'motivation',
        evaluatorType: 'humanistic',
        question: 'q2',
        answer: 'a2',
        timestamp: '2026-04-15T00:01:00.000Z',
      },
      {
        dimension: 'scope',
        evaluatorType: 'humanistic',
        question: 'q3',
        answer: 'a3',
        timestamp: '2026-04-15T00:02:00.000Z',
      },
      {
        dimension: 'user-story',
        evaluatorType: 'domain',
        question: 'q4',
        answer: 'a4',
        timestamp: '2026-04-15T00:03:00.000Z',
      },
      {
        dimension: 'boundary',
        evaluatorType: 'reference',
        question: 'q5',
        answer: 'a5',
        timestamp: '2026-04-15T00:04:00.000Z',
      },
      {
        dimension: 'impact',
        evaluatorType: 'consistency',
        question: 'q6',
        answer: 'a6',
        timestamp: '2026-04-15T00:05:00.000Z',
      },
    ]

    const input = [
      '왜 필요한가: create 단계 반복 기록이 잘 보여야 한다.',
      '범위: questionTrail을 유지한다.',
      '사용자: proposal 작성자.',
      '제외: 점수 계산식 변경 없음.',
      '영향: ygg-point.json 출력.',
    ].join('\n')

    const document = createYggPointDocument({
      topic: 'long-create-loop',
      date: '2026-04-15',
      archiveType: 'feat',
      currentStage: 'create',
      stageDef: createStageDefinition,
      userInput: input,
      history,
    })

    expect(document.stages.create?.questionsAnswered).toBe(6)
    expect(document.stages.create?.rounds).toBe(7)
    expect(document.stages.create?.dimensions.motivation?.questionTrail[1]?.round).toBe(2)
    expect(document.stages.create?.dimensions.scope?.questionTrail[0]?.round).toBe(1)
    expect(document.stages.create?.dimensions.impact?.questionTrail[0]?.round).toBe(1)
  })

  it('merges a next snapshot into an existing document while preserving request text', () => {
    const createDocument = createYggPointDocument({
      topic: 'merged-ygg-point',
      date: '2026-04-15',
      requestText: '처음 작성자가 남긴 질문',
      archiveType: 'feat',
      currentStage: 'create',
      stageDef: createStageDefinition,
      userInput: '왜 필요한가: create 문서 생성',
      history: [],
    })

    const mergedDocument = createYggPointDocument({
      currentStage: 'next',
      stageDef: nextStageDefinition,
      userInput: '처음 작성자가 남긴 질문\n\n# Proposal',
      history: [],
      existingDocument: createDocument,
    })

    expect(mergedDocument.requestText).toBe('처음 작성자가 남긴 질문')
    expect(mergedDocument.currentStage).toBe('next')
    expect(mergedDocument.stages.create).toBeDefined()
    expect(mergedDocument.stages.next).toBeDefined()
  })
})
