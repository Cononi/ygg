import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

import { MarkdownRenderer } from './MarkdownRenderer'
import type { ProjectContentType } from '../types'

interface ProjectContentComposerProps {
  open: boolean
  title: string
  defaultType: ProjectContentType
  allowTypeChange?: boolean
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: { type: ProjectContentType; title: string; bodyMarkdown: string }) => Promise<void>
}

const CONTENT_TYPES: ProjectContentType[] = ['skills', 'agents', 'commands', 'changes']

export function ProjectContentComposer({
  open,
  title,
  defaultType,
  allowTypeChange = false,
  saving = false,
  onClose,
  onSubmit,
}: ProjectContentComposerProps) {
  const [type, setType] = useState<ProjectContentType>(defaultType)
  const [entryTitle, setEntryTitle] = useState('')
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [panel, setPanel] = useState<'write' | 'preview'>('write')

  const reset = () => {
    setType(defaultType)
    setEntryTitle('')
    setBodyMarkdown('')
    setPanel('write')
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    await onSubmit({
      type,
      title: entryTitle.trim(),
      bodyMarkdown,
    })
    reset()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {allowTypeChange && (
            <TextField
              select
              label="콘텐츠 타입"
              value={type}
              onChange={event => setType(event.target.value as ProjectContentType)}
            >
              {CONTENT_TYPES.map(option => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            label="제목"
            value={entryTitle}
            onChange={event => setEntryTitle(event.target.value)}
            fullWidth
          />

          <Tabs value={panel} onChange={(_, value: 'write' | 'preview') => setPanel(value)}>
            <Tab value="write" label="작성" />
            <Tab value="preview" label="미리보기" />
          </Tabs>

          {panel === 'write' ? (
            <TextField
              label="본문"
              value={bodyMarkdown}
              onChange={event => setBodyMarkdown(event.target.value)}
              multiline
              minRows={16}
              fullWidth
              inputProps={{
                spellCheck: false,
                style: { fontFamily: 'Monaco, Consolas, monospace', lineHeight: 1.6 },
              }}
            />
          ) : (
            <Box sx={{ minHeight: 360, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}>
              {bodyMarkdown.trim() ? (
                <MarkdownRenderer content={bodyMarkdown} />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  미리보기를 보려면 내용을 입력하세요.
                </Typography>
              )}
            </Box>
          )}

          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1.5 }}>
              저장 전 미리보기
            </Typography>
            {bodyMarkdown.trim() ? (
              <MarkdownRenderer content={bodyMarkdown} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                저장 전에 항상 이 영역에서 렌더링 결과를 확인할 수 있습니다.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>취소</Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={saving || !entryTitle.trim() || !bodyMarkdown.trim()}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
