import { describe, expect, it } from 'vitest'

import {
  buildYggPointStageDimensionRows,
  getLegacyYggPointDimensions,
  getYggPointSummaryDimensions,
  normalizeYggPointJson,
  YGG_POINT_TABLE_HEADERS,
} from '../../../packages/dashboard/src/pages/topicDetailYggPoint.js'
import type { YggPointJson } from '../../../packages/dashboard/src/pages/topicDetailYggPoint.js'

const sampleJson: YggPointJson = {
  schemaVersion: '2.0',
  requestText: '처음 작성자가 남긴 질문',
  score: 0.97,
  threshold: 0.95,
  currentStage: 'next',
  ready: true,
  stages: {
    create: {
      finalScore: 0.98,
      initialScore: 0.84,
      delta: 0.14,
      dimensions: {
        motivation: {
          description: 'Why this change matters',
          initialScore: 0.84,
          finalScore: 0.98,
          delta: 0.14,
          rationale: 'Rationale text',
          questionTrail: [
            {
              round: 1,
              answerSource: 'user',
              evaluatorType: 'humanistic',
              question: '이 변경이 왜 필요한가요?',
              answer: '사용자가 차원 의미와 점수 상승 이유를 더 빨리 이해할 수 있습니다.',
              scoreBefore: 0.84,
              scoreAfter: 0.98,
              delta: 0.14,
            },
          ],
        },
      },
    },
    next: {
      finalScore: 0.97,
      initialScore: 0.89,
      delta: 0.08,
      dimensions: {
        architecture: {
          description: 'Implementation structure',
          initialScore: 0.89,
          finalScore: 0.97,
          delta: 0.08,
          rationale: 'Structure rationale',
          notes: 'Notes text',
          questionTrail: [
            {
              round: 3,
              answerSource: 'auto',
              evaluatorType: 'reference',
              question: '어떤 구조로 구현하나요?',
              answer: '상단 요약과 행 확장형 이력을 유지하면서 Topic Detail 내부에서만 정리합니다.',
              scoreBefore: 0.89,
              scoreAfter: 0.97,
              delta: 0.08,
            },
          ],
        },
        rollback: {
          description: 'Rollback feasibility',
          initialScore: 0.9,
          finalScore: 0.96,
          delta: 0.06,
          rationale: 'Rollback rationale',
          notes: 'No expandable history here',
          questionTrail: [],
        },
      },
    },
  },
}

describe('topic detail ygg-point view helpers', () => {
  it('normalizes pre-standard create/next snapshots into the current viewer shape', () => {
    const legacyJson: YggPointJson = {
      request: 'init/update 최근 기능 누락을 확인하고 반영한다.',
      stage: 'add',
      status: 'ready',
      archiveType: 'fix',
      create: {
        initialScore: 0.91,
        finalScore: 0.97,
        delta: 0.06,
        summary: {
          motivation: 0.98,
          scope: 0.97,
        },
      },
      next: {
        initialScore: 0.93,
        finalScore: 0.97,
        delta: 0.04,
        summary: {
          architecture: 0.98,
          tradeoff: 0.96,
        },
        questionTrail: {
          architecture: [
            {
              round: 1,
              evaluator: 'reference/consistency',
              question: '어떤 구조가 최근 기능 누락을 가장 안정적으로 막는가?',
              answer: '템플릿 디렉토리 스캔 결과를 단일 기준으로 둔다.',
              answerSource: 'assistant-inferred',
              scoreBefore: 0.92,
              scoreAfter: 0.98,
            },
          ],
        },
      },
      questionTrail: {
        motivation: [
          {
            round: 1,
            evaluator: 'humanistic/domain',
            question: '이번 변경의 핵심 목적은 무엇인가?',
            answer: 'init + update 결과가 항상 동기화되도록 한다.',
            answerSource: 'user',
            scoreBefore: 0.9,
            scoreAfter: 0.98,
          },
        ],
      },
    }

    const normalized = normalizeYggPointJson(legacyJson)

    expect(normalized.schemaVersion).toBe('2.0')
    expect(normalized.requestText).toBe('init/update 최근 기능 누락을 확인하고 반영한다.')
    expect(normalized.currentStage).toBe('next')
    expect(normalized.ready).toBe(true)
    expect(normalized.score).toBe(0.97)
    expect(normalized.stages?.create?.dimensions.motivation?.questionTrail[0]).toMatchObject({
      evaluatorType: 'humanistic/domain',
      answerSource: 'user',
      scoreBefore: 0.9,
      scoreAfter: 0.98,
    })
    expect(normalized.stages?.next?.dimensions.architecture?.questionTrail[0]).toMatchObject({
      evaluatorType: 'reference/consistency',
      answer: '템플릿 디렉토리 스캔 결과를 단일 기준으로 둔다.',
    })
  })

  it('returns an empty legacy dimension map when schema 2.0 data omits top-level dimensions', () => {
    expect(getLegacyYggPointDimensions(sampleJson)).toEqual({})
  })

  it('builds a single top summary from the current stage and omits the 최고 column header', () => {
    const summary = getYggPointSummaryDimensions(sampleJson)

    expect(summary.stageName).toBe('next')
    expect(summary.dimensions).toEqual([
      { name: 'architecture', description: 'Implementation structure' },
      { name: 'rollback', description: 'Rollback feasibility' },
    ])
    expect(YGG_POINT_TABLE_HEADERS).toEqual(['차원', '초기', '최종', '상승', '근거'])
    expect(YGG_POINT_TABLE_HEADERS).not.toContain('최고')
    expect(YGG_POINT_TABLE_HEADERS).not.toContain('최종 질답')
  })

  it('builds expandable row models with compact before/after trail details', () => {
    const rows = buildYggPointStageDimensionRows('next', sampleJson.stages?.next?.dimensions, new Set(['next:architecture']))

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      rowId: 'next:architecture',
      name: 'architecture',
      initialScoreLabel: '0.890',
      finalScoreLabel: '0.970',
      scoreChangeLabel: '0.890 → 0.970 (+0.080)',
      historyChipLabel: '이력보기',
      canExpand: true,
      noteLabel: '평가 메모: Notes text',
    })
    expect(rows[0]?.trailCards[0]).toMatchObject({
      roundLabel: 'Round 3',
      beforeAfterLabel: '0.890 → 0.970',
      deltaLabel: '+0.080',
      answerSourceLabel: 'source auto',
      question: '어떤 구조로 구현하나요?',
      answer: '상단 요약과 행 확장형 이력을 유지하면서 Topic Detail 내부에서만 정리합니다.',
      finalQaChipLabel: '최종 질답',
    })
    expect(rows[1]).toMatchObject({
      rowId: 'next:rollback',
      historyChipLabel: '이력없음',
      canExpand: false,
    })
  })

  it('preserves legacy top-level dimensions for fallback rendering', () => {
    const legacyJson: YggPointJson = {
      score: 0.74,
      phase: 'create',
      dimensions: {
        motivation: {
          score: 0.8,
          notes: 'Why this matters',
        },
      },
    }

    expect(getLegacyYggPointDimensions(legacyJson)).toEqual({
      motivation: {
        score: 0.8,
        notes: 'Why this matters',
      },
    })
  })
})
