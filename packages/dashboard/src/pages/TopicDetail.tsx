import { Fragment, useState, useEffect, useCallback, useDeferredValue } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Collapse from '@mui/material/Collapse'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import { api } from '../api/client'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { ARCHIVE_STATUS_LABEL } from '../types'
import type { ChangeEntry } from '../types'
import type { FileNode } from '../types'
import {
  buildYggPointHeadlineSummary,
  buildYggPointHighlightCards,
  buildYggPointPrimaryContext,
  buildYggPointStageDimensionRows,
  getLegacyYggPointDimensions,
  normalizeYggPointJson,
  YGG_POINT_TABLE_HEADERS,
} from './topicDetailYggPoint'
import type { YggPointJson } from './topicDetailYggPoint'

function getDaysSince(value?: string): string {
  if (!value || value === '-') return '-'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '-'

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = startOfToday.getTime() - parsed.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  return `${days}일 경과`
}

function formatArchiveVersionLabel(version?: string): string | null {
  if (!version || version === '-') return null
  return version.startsWith('v') ? version : `v${version}`
}

function FileTreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileNode
  depth: number
  selected: string | null
  onSelect: (path: string) => void
}) {
  const [open, setOpen] = useState(depth === 0)

  if (node.type === 'dir') {
    return (
      <>
        <ListItemButton
          onClick={() => setOpen(o => !o)}
          sx={{ pl: 2 + depth * 1.5, py: 0.5 }}
        >
          {open ? <FolderOpenIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} /> : <FolderIcon fontSize="small" sx={{ mr: 1, color: 'warning.main' }} />}
          <ListItemText primary={node.name} primaryTypographyProps={{ variant: 'body2' }} />
        </ListItemButton>
        <Collapse in={open}>
          {node.children?.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </Collapse>
      </>
    )
  }

  const isYggPoint = node.name === 'ygg-point.json'
  const isSelected = selected === node.path

  return (
    <ListItemButton
      selected={isSelected}
      onClick={() => onSelect(node.path)}
      sx={{ pl: 2 + depth * 1.5, py: 0.5 }}
    >
      {isYggPoint
        ? <GpsFixedIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
        : <InsertDriveFileIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
      }
      <ListItemText primary={node.name} primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }} />
    </ListItemButton>
  )
}

export function YggPointViewer({
  json,
  initialExpandedRows = [],
}: {
  json: YggPointJson
  initialExpandedRows?: string[]
}) {
  const normalizedJson = normalizeYggPointJson(json)
  const stages = normalizedJson.stages ?? {}
  const stageEntries = Object.entries(stages)
  const headlineSummary = buildYggPointHeadlineSummary(normalizedJson)
  const primaryContext = buildYggPointPrimaryContext(normalizedJson)
  const highlightCards = buildYggPointHighlightCards(normalizedJson)
  const dims = getLegacyYggPointDimensions(normalizedJson)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set(initialExpandedRows))

  if (normalizedJson.schemaVersion === '2.0' && stageEntries.length > 0) {
    return (
      <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} useFlexGap justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
            <Stack direction="row" spacing={1} useFlexGap alignItems="center">
              <Typography variant="overline" color="text.secondary">
                메인 컨텍스트
              </Typography>
              {normalizedJson.currentStage && <Chip label={normalizedJson.currentStage} size="small" variant="outlined" />}
            </Stack>
            {typeof normalizedJson.ready === 'boolean' && (
              <Chip label={normalizedJson.ready ? 'ready' : 'not ready'} size="small" color={normalizedJson.ready ? 'success' : 'warning'} />
            )}
          </Stack>
          <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                최초 질문
              </Typography>
              <Typography variant="body1" fontWeight={700} sx={{ whiteSpace: 'pre-wrap' }}>
                {primaryContext.requestText ?? '초기 요청 정보가 없습니다.'}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                최종 반영 답변
              </Typography>
              <Typography variant="body1" fontWeight={700} sx={{ whiteSpace: 'pre-wrap' }}>
                {primaryContext.finalAnswer ?? '최종 반영 답변 이력이 없습니다.'}
              </Typography>
            </Paper>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            useFlexGap
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', lg: 'flex-start' }}
          >
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Stack direction="row" spacing={1} useFlexGap alignItems="center">
                <Typography variant="overline" color="text.secondary">
                  결과 요약
                </Typography>
                <Chip label={headlineSummary.stageLabel} size="small" variant="outlined" />
                <Chip
                  label={headlineSummary.readyLabel}
                  size="small"
                  color={normalizedJson.ready ? 'success' : 'warning'}
                />
              </Stack>
              <Typography variant="h5" fontWeight={800}>
                {headlineSummary.headline}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {headlineSummary.supportingText}
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
              <Paper variant="outlined" sx={{ p: 1.5, minWidth: 112 }}>
                <Typography variant="caption" color="text.secondary">점수</Typography>
                <Typography variant="h4" fontWeight={800}>{headlineSummary.scoreLabel}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5, minWidth: 112 }}>
                <Typography variant="caption" color="text.secondary">threshold</Typography>
                <Typography variant="h6" fontWeight={700}>{headlineSummary.thresholdLabel}</Typography>
              </Paper>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mt: 1.75 }}>
            <Typography variant="body2" fontWeight={700}>
              종합 점수: {normalizedJson.score ?? '—'}
            </Typography>
            {normalizedJson.currentStage && <Chip label={normalizedJson.currentStage} size="small" variant="outlined" />}
            {typeof normalizedJson.threshold === 'number' && <Chip label={`threshold ${normalizedJson.threshold.toFixed(2)}`} size="small" variant="outlined" />}
            {typeof normalizedJson.ready === 'boolean' && <Chip label={normalizedJson.ready ? 'ready' : 'not ready'} size="small" color={normalizedJson.ready ? 'success' : 'warning'} />}
          </Stack>
        </Paper>

        {highlightCards.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                핵심 판단 근거
              </Typography>
              <Chip label={headlineSummary.stageLabel} size="small" variant="outlined" />
            </Stack>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              {highlightCards.map((card) => (
                <Paper key={card.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ mb: 1 }}>
                    <Chip
                      label={card.statusLabel}
                      size="small"
                      color={card.statusLabel === '미달 이유' ? 'warning' : 'success'}
                    />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {card.title}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1 }}>
                    <Chip label={card.scoreLabel} size="small" variant="outlined" />
                    <Chip label={card.deltaLabel} size="small" variant="outlined" />
                    <Chip label={card.trailCountLabel} size="small" variant="outlined" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {card.summary}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Paper>
        )}

        {stageEntries.map(([stageName, stage]) => {
          const stageDimensionRows = buildYggPointStageDimensionRows(stageName, stage.dimensions, expandedRows)
          return (
            <Paper key={stageName} variant="outlined" sx={{ p: 2, display: 'grid', gap: 2 }}>
              <Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>{stageName} 드릴다운</Typography>
                  {typeof stage.finalScore === 'number' && <Chip label={`final ${stage.finalScore.toFixed(3)}`} size="small" color="primary" />}
                  {typeof stage.initialScore === 'number' && <Chip label={`initial ${stage.initialScore.toFixed(3)}`} size="small" variant="outlined" />}
                  {typeof stage.delta === 'number' && <Chip label={`delta ${stage.delta >= 0 ? '+' : ''}${stage.delta.toFixed(3)}`} size="small" variant="outlined" />}
                </Stack>
                {stage.improvementSummary && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {stage.improvementSummary}
                  </Typography>
                )}
              </Box>

              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                <Box component="thead">
                  <Box component="tr">
                    {YGG_POINT_TABLE_HEADERS.map(h => (
                      <Box component="th" key={h} sx={{ textAlign: 'left', p: 1, borderBottom: '1px solid', borderColor: 'divider', typography: 'caption', fontWeight: 700 }}>{h}</Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {stageDimensionRows.map((row) => {
                    const isExpandable = row.canExpand
                    const rowId = row.rowId
                    const isExpanded = expandedRows.has(rowId)

                    return (
                      <Fragment key={rowId}>
                        <Box
                          component="tr"
                          onClick={isExpandable ? () => {
                            setExpandedRows((previous) => {
                              const next = new Set(previous)
                              if (next.has(rowId)) next.delete(rowId)
                              else next.add(rowId)
                              return next
                            })
                          } : undefined}
                          sx={isExpandable ? {
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                          } : undefined}
                        >
                          <Box component="td" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Stack direction="row" spacing={1} useFlexGap alignItems="center">
                              <Chip
                                label={row.historyChipLabel}
                                size="small"
                                variant="outlined"
                                color={isExpandable ? (isExpanded ? 'primary' : 'default') : 'default'}
                              />
                              <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {row.name}
                              </Typography>
                            </Stack>
                          </Box>
                          <Box component="td" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>{row.initialScoreLabel}</Box>
                          <Box component="td" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>{row.finalScoreLabel}</Box>
                          <Box component="td" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            {row.scoreChangeLabel}
                          </Box>
                          <Box component="td" sx={{ p: 1, fontSize: '0.8rem', color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>{row.rationale}</Box>
                        </Box>

                        {isExpandable && isExpanded && (
                          <Box
                            component="tr"
                            key={`${rowId}-details`}
                          >
                            <Box component="td" colSpan={5} sx={{ p: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                              <Box sx={{ p: 1.5, bgcolor: 'action.hover', display: 'grid', gap: 1 }}>
                                {row.trailCards.map((trailCard, index) => (
                                  <Paper key={`${rowId}-trail-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 0.75 }}>
                                      <Chip label={trailCard.roundLabel} size="small" />
                                      <Chip label={trailCard.beforeAfterLabel} size="small" variant="outlined" />
                                      <Chip label={trailCard.deltaLabel} size="small" color={trailCard.deltaLabel.startsWith('+') ? 'success' : 'default'} variant="outlined" />
                                      {trailCard.answerSourceLabel && <Chip label={trailCard.answerSourceLabel} size="small" variant="outlined" />}
                                      {trailCard.evaluatorType && <Chip label={trailCard.evaluatorType} size="small" variant="outlined" />}
                                      {trailCard.finalQaChipLabel && <Chip label={trailCard.finalQaChipLabel} size="small" color="primary" />}
                                    </Stack>
                                    {row.noteLabel && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                        {row.noteLabel}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
                                      질문
                                    </Typography>
                                    <Typography variant="body2" sx={{
                                      color: 'text.secondary',
                                      mb: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {trailCard.question}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, mb: 0.5 }}>
                                      답변
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                    }}>
                                      {trailCard.answer}
                                    </Typography>
                                  </Paper>
                                ))}
                              </Box>
                            </Box>
                          </Box>
                        )}
                      </Fragment>
                    )
                  })}
                </Box>
              </Box>
            </Paper>
          )
        })}
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body1" fontWeight={700}>
          종합 점수: {normalizedJson.score ?? '—'}
        </Typography>
        {normalizedJson.phase && <Chip label={normalizedJson.phase} size="small" variant="outlined" />}
        {normalizedJson.evaluatedAt && (
          <Typography variant="caption" color="text.secondary">{normalizedJson.evaluatedAt}</Typography>
        )}
      </Box>
      {Object.keys(dims).length > 0 && (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
          <Box component="thead">
            <Box component="tr">
              {['차원', '점수', '비고'].map(h => (
                <Box component="th" key={h} sx={{ textAlign: 'left', p: 1, borderBottom: '1px solid', borderColor: 'divider', typography: 'caption', fontWeight: 700 }}>{h}</Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {Object.entries(dims).map(([key, val]) => (
              <Box component="tr" key={key}>
                <Box component="td" sx={{ p: 1, fontFamily: 'monospace', fontSize: '0.8rem', borderBottom: '1px solid', borderColor: 'divider' }}>{key}</Box>
                <Box component="td" sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>{val.score ?? '—'}</Box>
                <Box component="td" sx={{ p: 1, fontSize: '0.8rem', color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>{val.notes ?? val.note ?? ''}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

function FileViewer({
  projectId,
  topic,
  filePath,
}: {
  projectId: string
  topic: string
  filePath: string
}) {
  const [content, setContent] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'markdown' | 'json' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const previewContent = useDeferredValue(editContent)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.changes.file(projectId, topic, filePath)
      setContent(data.content)
      setFileType(data.fileType)
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일을 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }, [projectId, topic, filePath])

  useEffect(() => { void load() }, [load])

  const handleEdit = () => {
    setEditContent(content ?? '')
    setSaveError(null)
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveError(null)
      await api.changes.saveFile(projectId, topic, filePath, editContent)
      setContent(editContent)
      setEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
  if (content === null) return null

  if (editing) {
    const isMarkdown = fileType === 'markdown'

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1, gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Button variant="contained" size="small" onClick={() => void handleSave()} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
          <Button variant="outlined" size="small" onClick={handleCancel} disabled={saving}>취소</Button>
          {saveError && <Alert severity="error" sx={{ py: 0, flexGrow: 1 }}>{saveError}</Alert>}
        </Box>
        {isMarkdown ? (
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
              flexGrow: 1,
              minHeight: 0,
            }}
          >
            <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: { xs: 320, md: '100%' } }}>
              <Typography
                variant="caption"
                sx={{ display: 'block', px: 1.5, py: 1, bgcolor: 'action.hover', color: 'text.secondary', fontFamily: 'monospace' }}
              >
                markdown source
              </Typography>
              <TextField
                multiline
                fullWidth
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                inputProps={{ spellCheck: false, style: { fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.7 } }}
                sx={{
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': { alignItems: 'flex-start', border: 0, borderRadius: 0 },
                  '& .MuiOutlinedInput-notchedOutline': { border: 0 },
                  '& textarea': { minHeight: { xs: 280, md: 'calc(100vh - 380px)' } },
                }}
              />
            </Paper>

            <Paper variant="outlined" sx={{ overflow: 'auto', minHeight: { xs: 240, md: '100%' } }}>
              <Typography
                variant="caption"
                sx={{ display: 'block', px: 1.5, py: 1, bgcolor: 'action.hover', color: 'text.secondary', fontFamily: 'monospace' }}
              >
                preview
              </Typography>
              <Divider />
              <MarkdownRenderer content={previewContent} />
            </Paper>
          </Box>
        ) : (
          <TextField
            multiline
            fullWidth
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            inputProps={{ spellCheck: false, style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            sx={{ flexGrow: 1 }}
            minRows={20}
          />
        )}
      </Box>
    )
  }

  const renderContent = () => {
    if (fileType === 'markdown') {
      return <MarkdownRenderer content={content} />
    }
    if (fileType === 'json' && filePath.includes('ygg-point')) {
      try {
        const parsed = JSON.parse(content) as YggPointJson
        return <YggPointViewer json={parsed} />
      } catch {
        // fall through
      }
    }
    return (
      <Box component="pre" sx={{ p: 2, fontFamily: 'monospace', fontSize: '0.85rem', overflowX: 'auto', m: 0 }}>
        {content}
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Button variant="outlined" size="small" onClick={handleEdit}>편집</Button>
      </Box>
      {renderContent()}
    </Box>
  )
}

export default function TopicDetail() {
  const { id, topic, archiveTopic } = useParams<{ id: string; topic: string; archiveTopic?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const fullTopic = archiveTopic ? `archive/${archiveTopic}` : (topic ?? '')
  const displayTopic = archiveTopic ?? topic ?? ''
  const navigationState = (location.state ?? null) as {
    from?: { pathname: string; search?: string; hash?: string }
    projectDetailTab?: 'changes'
    changesSubTab?: 'active' | 'archive'
    changeEntry?: ChangeEntry
  } | null
  const previousChange = navigationState?.changeEntry ?? null
  const archiveVersionLabel = formatArchiveVersionLabel(previousChange?.version)

  const handleBack = () => {
    if (navigationState?.from?.pathname) {
      navigate({
        pathname: navigationState.from.pathname,
        search: navigationState.from.search,
        hash: navigationState.from.hash,
      }, {
        state: {
          projectDetailTab: navigationState.projectDetailTab,
          changesSubTab: navigationState.changesSubTab,
        },
      })
      return
    }
    navigate(`/projects/${id}`, {
      state: {
        projectDetailTab: 'changes',
        changesSubTab: archiveTopic ? 'archive' : 'active',
      },
    })
  }

  const load = useCallback(async () => {
    if (!id || !fullTopic) return
    try {
      setLoading(true)
      setError(null)
      const data = await api.changes.detail(id, fullTopic)
      setFiles(data.files)
      const proposal = data.files.find(f => f.name === 'proposal.md' && f.type === 'file')
      if (proposal) setSelectedFile(proposal.path)
    } catch (e) {
      setError(e instanceof Error ? e.message : '토픽을 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }, [id, fullTopic])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    setSelectedFile(null)
  }, [fullTopic, id])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <IconButton onClick={handleBack}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary">
                Topic detail
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
                {displayTopic}
              </Typography>
            </Box>
          </Box>
          {archiveTopic && <Chip label={ARCHIVE_STATUS_LABEL} size="small" color="success" sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }} />}
        </Box>

        {previousChange && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} useFlexGap alignItems={{ xs: 'flex-start', md: 'center' }} flexWrap="wrap">
              {!archiveTopic ? (
                <>
                  <Chip label={previousChange.status || '—'} size="small" color={previousChange.status?.includes('완료') ? 'success' : 'warning'} />
                  <Chip label={previousChange.stage || '—'} size="small" variant="outlined" />
                  {previousChange.yggPoint && previousChange.yggPoint !== '-' && <Chip label={`YGG ${previousChange.yggPoint}`} size="small" variant="outlined" />}
                </>
              ) : null}
              {archiveVersionLabel && <Chip label={archiveVersionLabel} size="small" variant="outlined" />}
              {previousChange.latest === 'latest' && <Chip label="latest" size="small" color="primary" />}
              {previousChange.date && previousChange.date !== '-' && (
                <Stack direction="row" spacing={1} useFlexGap alignItems="center">
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {previousChange.date}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getDaysSince(previousChange.date)}
                  </Typography>
                </Stack>
              )}
            </Stack>
            {previousChange.description && previousChange.description !== '-' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                {previousChange.description}
              </Typography>
            )}
          </Paper>
        )}

        {files.length === 0 ? (
          <Typography color="text.secondary">파일이 없습니다.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, gap: 2, minHeight: { xs: 'auto', md: 'calc(100vh - 220px)' } }}>
            <Paper
              variant="outlined"
              sx={{ overflow: 'auto', borderRadius: 1, maxHeight: { xs: 320, md: 'none' } }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ display: 'block', px: 2, py: 1.25, color: 'text.secondary' }}>
                문서 트리
              </Typography>
              <Divider />
              <List dense disablePadding>
                {files.map(node => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selected={selectedFile}
                    onSelect={setSelectedFile}
                  />
                ))}
              </List>
            </Paper>

            <Paper variant="outlined" sx={{ overflow: 'auto', borderRadius: 1 }}>
              {selectedFile ? (
                <>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', px: 2, py: 1, bgcolor: 'action.hover', fontFamily: 'monospace', color: 'text.secondary' }}
                  >
                    {selectedFile}
                  </Typography>
                  <Divider />
                  <FileViewer
                    key={selectedFile}
                    projectId={id!}
                    topic={fullTopic}
                    filePath={selectedFile}
                  />
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">파일을 선택하세요</Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}
      </Stack>
    </Box>
  )
}
