export interface YggPointJson {
  topic?: string
  date?: string
  archiveType?: string
  schemaVersion?: string
  version?: string
  request?: string
  originalRequest?: string
  requestText?: string
  score?: number
  totalScore?: number
  total?: number
  initialScore?: number
  finalScore?: number
  delta?: number
  threshold?: number
  currentStage?: string
  stage?: string
  status?: string
  ready?: boolean
  summary?: Record<string, string> | Record<string, number>
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
    | Array<{
      id?: string
      key?: string
      label?: string
      displayName?: string
      description?: string
      reason?: string
      rationale?: string
      note?: string
      notes?: string
      score?: number
      initialScore?: number
      finalScore?: number
      delta?: number
      questionTrail?: Array<{
        round?: number
        evaluator?: string
        answerSource?: string
        question?: string
        answer?: string
        scoreBefore?: number
        scoreAfter?: number
      }>
    }>
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
  nextStage?: {
    status?: string
    initialScore?: number
    finalScore?: number
    delta?: number
    summary?: Record<string, string>
    dimensions?: Array<{
      id?: string
      key?: string
      label?: string
      displayName?: string
      description?: string
      reason?: string
      rationale?: string
      note?: string
      notes?: string
      score?: number
      initialScore?: number
      finalScore?: number
      delta?: number
      questionTrail?: Array<{
        round?: number
        evaluator?: string
        answerSource?: string
        question?: string
        answer?: string
        scoreBefore?: number
        scoreAfter?: number
      }>
    }>
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
      displayName?: string
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
  readonly displayName: string
  readonly description: string
}

export interface YggPointHeadlineSummary {
  readonly stageName: string | null
  readonly stageLabel: string
  readonly scoreLabel: string
  readonly thresholdLabel: string
  readonly readyLabel: string
  readonly headline: string
  readonly supportingText: string
}

export interface YggPointHighlightCard {
  readonly id: string
  readonly title: string
  readonly statusLabel: string
  readonly scoreLabel: string
  readonly deltaLabel: string
  readonly trailCountLabel: string
  readonly summary: string
}

export interface YggPointPrimaryContext {
  readonly requestText: string | null
  readonly finalAnswer: string | null
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
      displayName: detail.displayName ?? name,
      description: detail.description ?? '설명이 없습니다.',
    }))
    : []

  return { stageName, dimensions }
}

function getCurrentStageEntry(json: YggPointJson): {
  stageName: string | null
  stage: NonNullable<YggPointJson['stages']>[string] | null
} {
  const stages = json.stages ?? {}
  const stageEntries = Object.entries(stages)
  const stageName = json.currentStage && stages[json.currentStage]
    ? json.currentStage
    : stageEntries[0]?.[0] ?? null

  return {
    stageName,
    stage: stageName ? stages[stageName] ?? null : null,
  }
}

function truncateText(value: string | undefined, maxLength: number): string {
  const text = value?.trim() ?? ''
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function getRequestText(json: YggPointJson): string | null {
  const value = json.requestText ?? json.originalRequest ?? json.request
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getLatestTrailAnswer(
  dimensions: NonNullable<YggPointJson['stages']>[string]['dimensions'] | undefined,
): string | null {
  const latestEntry = Object.values(dimensions ?? {})
    .flatMap(detail => detail.questionTrail ?? [])
    .filter(entry => typeof entry.answer === 'string' && entry.answer.trim())
    .sort((left, right) => {
      const roundDiff = (right.round ?? -1) - (left.round ?? -1)
      if (roundDiff !== 0) return roundDiff
      return (right.scoreAfter ?? Number.NEGATIVE_INFINITY) - (left.scoreAfter ?? Number.NEGATIVE_INFINITY)
    })[0]

  return latestEntry?.answer?.trim() ?? null
}

function getLegacyLatestTrailAnswer(json: YggPointJson): string | null {
  const createTrail = Object.values(toLegacyQuestionTrail(json.questionTrail)).flat()
  const nextTrail = Object.values(toLegacyQuestionTrail(json.next)).flat()
  const latestEntry = [...createTrail, ...nextTrail]
    .filter(entry => typeof entry.answer === 'string' && entry.answer.trim())
    .sort((left, right) => {
      const roundDiff = (right.round ?? -1) - (left.round ?? -1)
      if (roundDiff !== 0) return roundDiff
      return (right.scoreAfter ?? Number.NEGATIVE_INFINITY) - (left.scoreAfter ?? Number.NEGATIVE_INFINITY)
    })[0]

  return latestEntry?.answer?.trim() ?? null
}

export function buildYggPointPrimaryContext(json: YggPointJson): YggPointPrimaryContext {
  const normalized = normalizeYggPointJson(json)
  const { stage } = getCurrentStageEntry(normalized)

  return {
    requestText: getRequestText(normalized),
    finalAnswer: getLatestTrailAnswer(stage?.dimensions) ?? getLegacyLatestTrailAnswer(json),
  }
}

export function buildYggPointHeadlineSummary(json: YggPointJson): YggPointHeadlineSummary {
  const { stageName, stage } = getCurrentStageEntry(json)
  const scoreValue = typeof json.score === 'number'
    ? json.score
    : stage?.finalScore
  const thresholdValue = typeof json.threshold === 'number'
    ? json.threshold
    : DEFAULT_THRESHOLD
  const ready = typeof json.ready === 'boolean'
    ? json.ready
    : Boolean(stage?.ready)
  const dimensions = Object.values(stage?.dimensions ?? {})
  const belowThresholdCount = dimensions.filter((detail) => {
    if (typeof detail.finalScore !== 'number') return false
    return detail.finalScore < thresholdValue
  }).length
  const weakestDimension = [...dimensions]
    .filter((detail) => typeof detail.finalScore === 'number')
    .sort((left, right) => (left.finalScore ?? 0) - (right.finalScore ?? 0))[0]

  return {
    stageName,
    stageLabel: stageName ? `${stageName} 기준` : 'stage 없음',
    scoreLabel: formatScoreValue(scoreValue),
    thresholdLabel: formatScoreValue(thresholdValue),
    readyLabel: ready ? 'ready' : 'not ready',
    headline: ready
      ? '현재 결과는 기준을 충족합니다.'
      : '현재 결과는 아직 기준에 미달합니다.',
    supportingText: ready
      ? `${dimensions.length}개 차원 근거를 확인할 수 있으며, 세부 질문/답변 이력은 아래 드릴다운에서 계속 볼 수 있습니다.`
      : belowThresholdCount > 0
        ? `${belowThresholdCount}개 차원이 threshold ${formatScoreValue(thresholdValue)} 아래에 있습니다. 가장 약한 차원은 ${weakestDimension?.displayName ?? '알 수 없음'}입니다.`
        : '세부 근거를 확인해 보완이 필요한 차원을 판단하세요.',
  }
}

export function buildYggPointHighlightCards(
  json: YggPointJson,
  maxCards = 3,
): YggPointHighlightCard[] {
  const { stageName, stage } = getCurrentStageEntry(json)
  const thresholdValue = typeof json.threshold === 'number'
    ? json.threshold
    : DEFAULT_THRESHOLD

  const cards = Object.entries(stage?.dimensions ?? {}).map(([name, detail]) => {
    const finalScore = detail.finalScore
    const delta = detail.delta
    const trailCount = detail.questionTrail?.length ?? 0
    const summary = truncateText(detail.notes || detail.rationale || detail.description, 180)
    const underThreshold = typeof finalScore === 'number' && finalScore < thresholdValue

    return {
      id: createYggPointRowId(stageName ?? 'stage', name),
      title: detail.displayName ?? name,
      statusLabel: underThreshold ? '미달 이유' : '통과 근거',
      scoreLabel: `최종 ${formatScoreValue(finalScore)}`,
      deltaLabel: `상승 ${formatScoreDelta(delta)}`,
      trailCountLabel: `질답 ${trailCount}개`,
      summary,
      priority: underThreshold ? 0 : 1,
      finalScore: finalScore ?? -1,
      deltaScore: delta ?? Number.NEGATIVE_INFINITY,
    }
  })

  return cards
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority
      if (left.priority === 0) return left.finalScore - right.finalScore
      return right.deltaScore - left.deltaScore
    })
    .slice(0, maxCards)
    .map(({ priority: _priority, finalScore: _finalScore, deltaScore: _deltaScore, ...card }) => card)
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
  if (json.stage === 'add' || json.stage === 'qa' || json.stage === 'teams' || json.stage === 'prove') return 'next'
  if (json.nextStage) return 'next'
  if (json.next) return 'next'
  if (json.create) return 'create'
  return 'create'
}

type LegacyTrailEntry = {
  round?: number
  answerSource?: string
  evaluatorType?: string
  question?: string
  answer?: string
  scoreBefore?: number
  scoreAfter?: number
  delta?: number
}

type LegacyArrayDimension = NonNullable<Extract<YggPointJson['dimensions'], readonly unknown[]>>[number]

function normalizeArrayStage(
  stageName: 'create' | 'next',
  stageData: {
    initialScore?: number
    finalScore?: number
    delta?: number
    status?: string
    summary?: Record<string, string> | Record<string, number>
    dimensions?: LegacyArrayDimension[]
  } | undefined,
): NonNullable<YggPointJson['stages']>[string] | undefined {
  if (!stageData) return undefined

  const descriptions = stageName === 'create' ? CREATE_DIMENSION_DESCRIPTIONS : NEXT_DIMENSION_DESCRIPTIONS
  const dimensions = Object.fromEntries(
    (stageData.dimensions ?? []).map((dimension, index) => {
      const name = dimension.id ?? dimension.key ?? `dimension-${index + 1}`
      const trail = (dimension.questionTrail ?? []).map((entry, trailIndex) => {
        const scoreBefore = entry.scoreBefore
        const scoreAfter = entry.scoreAfter ?? dimension.score ?? dimension.finalScore
        return {
          round: entry.round ?? trailIndex + 1,
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
        } satisfies LegacyTrailEntry
      })
      const inferredInitial = dimension.initialScore ?? trail[0]?.scoreBefore ?? stageData.initialScore
      const inferredFinal = dimension.finalScore ?? dimension.score ?? trail[trail.length - 1]?.scoreAfter
      const inferredDelta = dimension.delta ?? (
        typeof inferredInitial === 'number' && typeof inferredFinal === 'number'
          ? inferredFinal - inferredInitial
          : undefined
      )

      return [name, {
        displayName: dimension.displayName ?? dimension.label ?? descriptions[name] ?? name,
        description: dimension.description ?? descriptions[name] ?? dimension.label ?? name,
        initialScore: inferredInitial,
        finalScore: inferredFinal,
        delta: inferredDelta,
        rationale: dimension.rationale ?? dimension.reason ?? trail[trail.length - 1]?.answer ?? '',
        notes: dimension.notes ?? dimension.note ?? trail[trail.length - 1]?.question ?? '',
        questionTrail: trail,
      }]
    }),
  )

  const questionCount = Object.values(dimensions).reduce((sum, dimension) => sum + (dimension.questionTrail?.length ?? 0), 0)
  const rounds = Object.values(dimensions).reduce((max, dimension) => Math.max(max, ...((dimension.questionTrail ?? []).map(entry => entry.round ?? 0))), 0)

  return {
    ready: stageData.status ? stageData.status === 'ready' : true,
    initialScore: stageData.initialScore,
    finalScore: stageData.finalScore,
    delta: stageData.delta,
    rounds,
    questionsAnswered: questionCount,
    improvementSummary: Object.values(stageData.summary ?? {}).find(value => typeof value === 'string') ?? '',
    dimensions,
  }
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
        displayName: descriptions[dimensionName] ?? dimensionName,
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

  if (json.stages) {
    return {
      ...json,
      schemaVersion: '2.0',
      requestText: json.requestText ?? json.originalRequest ?? json.request,
      currentStage: json.currentStage ?? inferCurrentStage(json),
      score: json.score ?? json.totalScore ?? json.total ?? json.finalScore,
      threshold: json.threshold ?? DEFAULT_THRESHOLD,
      ready: json.ready ?? (json.status === 'ready' || json.status === 'approved'),
    }
  }

  const createStageFromArray = Array.isArray(json.dimensions)
    ? normalizeArrayStage('create', {
      initialScore: json.initialScore,
      finalScore: json.finalScore,
      delta: json.delta,
      status: json.status,
      summary: json.summary as Record<string, string> | undefined,
      dimensions: json.dimensions,
    })
    : undefined
  const nextStageFromArray = normalizeArrayStage('next', json.nextStage)

  if (!json.create && !json.next && !createStageFromArray && !nextStageFromArray) {
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
    requestText: json.requestText ?? json.originalRequest ?? json.request,
    archiveType: json.archiveType,
    currentStage,
    threshold: json.threshold ?? DEFAULT_THRESHOLD,
    score:
      json.score
      ?? json.totalScore
      ?? json.total
      ?? json.finalScore
      ?? currentStageSnapshot?.finalScore,
    ready: json.ready ?? (json.status === 'ready' || json.status === 'approved'),
    dimensions: json.dimensions,
    stages: {
      ...(createStageFromArray ? { create: createStageFromArray } : {}),
      ...(createStage ? { create: createStage } : {}),
      ...(nextStageFromArray ? { next: nextStageFromArray } : {}),
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
    const lastTrailIndex = questionTrail.length - 1
    const trailCards: YggPointTrailCard[] = questionTrail.map((entry, index) => ({
      roundLabel: `Round ${entry.round ?? index + 1}`,
      beforeAfterLabel: `${formatScoreValue(entry.scoreBefore)} → ${formatScoreValue(entry.scoreAfter)}`,
      deltaLabel: formatScoreDelta(entry.delta),
      answerSourceLabel: entry.answerSource ? `source ${entry.answerSource}` : null,
      evaluatorType: entry.evaluatorType,
      question: entry.question ?? '질문 없음',
      answer: entry.answer ?? '답변 없음',
      finalQaChipLabel: index === lastTrailIndex ? '최종 질답' : null,
    }))

    return {
      rowId,
      name: detail.displayName ?? name,
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
