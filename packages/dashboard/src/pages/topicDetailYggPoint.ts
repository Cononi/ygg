export interface YggPointJson {
  schemaVersion?: string
  version?: string
  request?: string
  requestText?: string
  score?: number
  totalScore?: number
  total?: number
  threshold?: number
  currentStage?: string
  stage?: string
  status?: string
  ready?: boolean
  history?: Array<{
    stage?: string
    dimension?: string
    evaluatorType?: string
    question?: string
    answer?: string
    timestamp?: string
    scoreBefore?: number
    scoreAfter?: number
  }>
  dimensions?: Record<string, { score?: number; note?: string; notes?: string }>
  create?: {
    initialScore?: number
    finalScore?: number
    delta?: number
    summary?: Record<string, number>
  }
  next?: {
    initialScore?: number
    finalScore?: number
    delta?: number
    summary?: Record<string, number>
    questionTrail?: Record<string, Array<{
      round?: number
      evaluator?: string
      question?: string
      answer?: string
      answerSource?: string
      scoreBefore?: number
      scoreAfter?: number
    }>>
  }
  questionTrail?: Record<string, Array<{
    round?: number
    evaluator?: string
    question?: string
    answer?: string
    answerSource?: string
    scoreBefore?: number
    scoreAfter?: number
  }>>
  stages?: Record<string, {
    ready?: boolean
    initialScore?: number
    finalScore?: number
    delta?: number
    rounds?: number
    questionsAnswered?: number
    improvementSummary?: string
    dimensions?: Record<string, {
      description?: string
      initialScore?: number
      finalScore?: number
      delta?: number
      rationale?: string
      notes?: string
      questionTrail?: Array<{
        round?: number
        answerSource?: string
        evaluatorType?: string
        question?: string
        answer?: string
        scoreBefore?: number
        scoreAfter?: number
        delta?: number
        timestamp?: string
      }>
    }>
  }>
  evaluatedAt?: string
  phase?: string
}

export interface YggPointSummaryDimension {
  readonly name: string
  readonly description: string
}

export interface YggPointTrailCard {
  readonly roundLabel: string
  readonly beforeAfterLabel: string
  readonly deltaLabel: string
  readonly answerSourceLabel: string | null
  readonly evaluatorType?: string
  readonly question: string
  readonly answer: string
  readonly finalQaChipLabel: string | null
}

export interface YggPointStageDimensionRow {
  readonly rowId: string
  readonly name: string
  readonly initialScoreLabel: string
  readonly finalScoreLabel: string
  readonly scoreChangeLabel: string
  readonly rationale: string
  readonly noteLabel: string | null
  readonly historyChipLabel: string
  readonly canExpand: boolean
  readonly trailCards: readonly YggPointTrailCard[]
}

export const YGG_POINT_TABLE_HEADERS = ['차원', '초기', '최종', '상승', '근거'] as const

const DEFAULT_THRESHOLD = 0.95

const CREATE_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  motivation: 'Why is this change needed',
  scope: 'Scope and target of change',
  'user-story': 'Who uses it and how',
  boundary: 'What will NOT be done',
  impact: 'Affected files/modules',
}

const NEXT_DIMENSION_DESCRIPTIONS: Record<string, string> = {
  architecture: 'Implementation structure/patterns',
  tradeoff: 'Pros/cons of choices',
  constraint: 'Technical/non-functional constraints',
  dependency: 'Implementation order, module dependencies',
  rollback: 'Rollback feasibility',
}

export function formatScoreValue(value?: number): string {
  return typeof value === 'number' ? value.toFixed(3) : '—'
}

export function formatScoreDelta(value?: number): string {
  if (typeof value !== 'number') return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
}

export function createYggPointRowId(stageName: string, dimensionName: string): string {
  return `${stageName}:${dimensionName}`
}

export function getYggPointSummaryDimensions(json: YggPointJson): {
  stageName?: string
  dimensions: readonly YggPointSummaryDimension[]
} {
  const stages = json.stages ?? {}
  const stageEntries = Object.entries(stages)
  const stageName = json.currentStage && stages[json.currentStage]
    ? json.currentStage
    : stageEntries[0]?.[0]

  const dimensions = stageName
    ? Object.entries(stages[stageName]?.dimensions ?? {}).map(([name, detail]) => ({
      name,
      description: detail.description ?? '설명이 없습니다.',
    }))
    : []

  return { stageName, dimensions }
}

export function getLegacyYggPointDimensions(
  json: YggPointJson,
): NonNullable<YggPointJson['dimensions']> {
  return json.dimensions ?? {}
}

function toLegacyQuestionTrail(
  trailByDimension: YggPointJson['questionTrail'] | YggPointJson['next'],
): Record<string, Array<{
  round?: number
  answerSource?: string
  evaluatorType?: string
  question?: string
  answer?: string
  scoreBefore?: number
  scoreAfter?: number
  delta?: number
 }>> {
  const source = Array.isArray(trailByDimension)
    ? {}
    : 'questionTrail' in (trailByDimension ?? {})
      ? ((trailByDimension as NonNullable<YggPointJson['next']>).questionTrail ?? {})
      : ((trailByDimension as YggPointJson['questionTrail']) ?? {})

  return Object.fromEntries(
    Object.entries(source).map(([dimensionName, entries]) => [
      dimensionName,
      (entries ?? []).map((entry, index) => {
        const scoreBefore = entry.scoreBefore
        const scoreAfter = entry.scoreAfter
        return {
          round: entry.round ?? index + 1,
          answerSource: entry.answerSource,
          evaluatorType: entry.evaluator,
          question: entry.question,
          answer: entry.answer,
          scoreBefore,
          scoreAfter,
          delta:
            typeof scoreBefore === 'number' && typeof scoreAfter === 'number'
              ? scoreAfter - scoreBefore
              : undefined,
        }
      }),
    ]),
  )
}

function inferCurrentStage(json: YggPointJson): string {
  if (json.currentStage) return json.currentStage
  if (json.stage === 'create' || json.stage === 'next') return json.stage
  if (json.next) return 'next'
  if (json.create) return 'create'
  return 'create'
}

function normalizeLegacyStage(
  stageName: 'create' | 'next',
  stageData: YggPointJson['create'] | YggPointJson['next'] | undefined,
  questionTrailByDimension: Record<string, Array<{
    round?: number
    answerSource?: string
    evaluatorType?: string
    question?: string
    answer?: string
    scoreBefore?: number
    scoreAfter?: number
    delta?: number
  }>>,
): NonNullable<YggPointJson['stages']>[string] | undefined {
  if (!stageData) return undefined

  const descriptions = stageName === 'create' ? CREATE_DIMENSION_DESCRIPTIONS : NEXT_DIMENSION_DESCRIPTIONS
  const dimensionScores = stageData.summary ?? {}
  const dimensions = Object.fromEntries(
    Object.entries(dimensionScores).map(([dimensionName, finalScore]) => {
      const trail = questionTrailByDimension[dimensionName] ?? []
      const firstBefore = trail[0]?.scoreBefore
      const lastAfter = trail[trail.length - 1]?.scoreAfter
      const inferredInitial = typeof firstBefore === 'number'
        ? firstBefore
        : stageData.initialScore
      const inferredFinal = typeof lastAfter === 'number'
        ? lastAfter
        : finalScore

      return [dimensionName, {
        description: descriptions[dimensionName] ?? dimensionName,
        initialScore: inferredInitial,
        finalScore: inferredFinal,
        delta:
          typeof inferredInitial === 'number' && typeof inferredFinal === 'number'
            ? inferredFinal - inferredInitial
            : undefined,
        rationale: trail[trail.length - 1]?.answer ?? '',
        notes: trail[trail.length - 1]?.question ?? '',
        questionTrail: trail,
      }]
    }),
  )

  return {
    ready: true,
    initialScore: stageData.initialScore,
    finalScore: stageData.finalScore,
    delta: stageData.delta,
    rounds: Object.values(questionTrailByDimension).reduce((max, entries) => {
      const localMax = Math.max(0, ...entries.map((entry) => entry.round ?? 0))
      return Math.max(max, localMax)
    }, 0),
    questionsAnswered: Object.values(questionTrailByDimension).reduce((sum, entries) => sum + entries.length, 0),
    improvementSummary: '',
    dimensions,
  }
}

export function normalizeYggPointJson(json: YggPointJson): YggPointJson {
  if (json.schemaVersion === '2.0' && json.stages) {
    return json
  }

  if (!json.create && !json.next) {
    return json
  }

  const createQuestionTrail = toLegacyQuestionTrail(json.questionTrail)
  const nextQuestionTrail = toLegacyQuestionTrail(json.next)
  const createStage = normalizeLegacyStage('create', json.create, createQuestionTrail)
  const nextStage = normalizeLegacyStage('next', json.next, nextQuestionTrail)
  const currentStage = inferCurrentStage(json)
  const currentStageSnapshot = currentStage === 'next' ? nextStage : createStage

  return {
    schemaVersion: '2.0',
    topic: json.topic,
    date: json.date,
    requestText: json.requestText ?? json.request,
    archiveType: json.archiveType,
    currentStage,
    threshold: json.threshold ?? DEFAULT_THRESHOLD,
    score:
      json.score
      ?? json.totalScore
      ?? json.total
      ?? currentStageSnapshot?.finalScore,
    ready: json.ready ?? (json.status === 'ready' || json.status === 'approved'),
    dimensions: json.dimensions,
    stages: {
      ...(createStage ? { create: createStage } : {}),
      ...(nextStage ? { next: nextStage } : {}),
    },
  }
}

export function buildYggPointStageDimensionRows(
  stageName: string,
  dimensions: NonNullable<YggPointJson['stages']>[string]['dimensions'] | undefined,
  _expandedRows: ReadonlySet<string>,
): YggPointStageDimensionRow[] {
  return Object.entries(dimensions ?? {}).map(([name, detail]) => {
    const rowId = createYggPointRowId(stageName, name)
    const questionTrail = detail.questionTrail ?? []
    const trailCards = questionTrail.map((entry, index) => ({
      roundLabel: `Round ${entry.round ?? index + 1}`,
      beforeAfterLabel: `${formatScoreValue(entry.scoreBefore)} → ${formatScoreValue(entry.scoreAfter)}`,
      deltaLabel: formatScoreDelta(entry.delta),
      answerSourceLabel: entry.answerSource ? `source ${entry.answerSource}` : null,
      evaluatorType: entry.evaluatorType,
      question: entry.question ?? '질문 없음',
      answer: entry.answer ?? '답변 없음',
      finalQaChipLabel: null,
    }))
    const lastTrailCard = trailCards[trailCards.length - 1]
    if (lastTrailCard) {
      lastTrailCard.finalQaChipLabel = '최종 질답'
    }

    return {
      rowId,
      name,
      initialScoreLabel: formatScoreValue(detail.initialScore),
      finalScoreLabel: formatScoreValue(detail.finalScore),
      scoreChangeLabel:
        typeof detail.initialScore === 'number' && typeof detail.finalScore === 'number'
          ? `${detail.initialScore.toFixed(3)} → ${detail.finalScore.toFixed(3)} (${formatScoreDelta(detail.delta)})`
          : formatScoreDelta(detail.delta),
      rationale: detail.rationale ?? '',
      noteLabel: detail.notes ? `평가 메모: ${detail.notes}` : null,
      historyChipLabel: trailCards.length > 0 ? '이력보기' : '이력없음',
      canExpand: trailCards.length > 0,
      trailCards,
    }
  })
}
