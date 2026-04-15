import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Toolbar from '@mui/material/Toolbar'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { api } from '../api/client'

export default function FileEditor() {
  const { id, target, type, name } = useParams<{ id: string; target: string; type: string; name: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [filePath, setFilePath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  const load = useCallback(async () => {
    if (!id || !target || !type || !name) return
    try {
      setLoading(true)
      const data = await api.files.get(id, decodeURIComponent(target), type, decodeURIComponent(name))
      setContent(data.content)
      setFilePath(data.path)
    } finally {
      setLoading(false)
    }
  }, [id, target, type, name])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    if (!id || !target || !type || !name) return
    try {
      setSaving(true)
      await api.files.save(id, decodeURIComponent(target), type, decodeURIComponent(name), content)
      setSnackbar({ msg: '저장되었습니다.', severity: 'success' })
    } catch (e) {
      setSnackbar({ msg: e instanceof Error ? e.message : '저장 실패', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, minHeight: 'calc(100vh - 64px)' }}>
      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', minHeight: { xs: 'calc(100vh - 120px)', md: 'calc(100vh - 112px)' }, borderRadius: 1, overflow: 'hidden' }}>
        <Toolbar sx={{ minHeight: 88, borderBottom: 1, borderColor: 'divider', alignItems: 'center', gap: 1.5 }}>
          <IconButton size="small" onClick={() => navigate(-1)} edge="start">
            <ArrowBackIcon />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              File editor
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {filePath}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {target && <Chip size="small" label={decodeURIComponent(target)} variant="outlined" />}
            {type && <Chip size="small" label={type} variant="outlined" />}
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleSave()}
              disabled={saving}
              sx={{ borderRadius: 1 }}
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Stack>
        </Toolbar>

        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <TextField
            multiline
            fullWidth
            value={content}
            onChange={e => setContent(e.target.value)}
            inputProps={{
              spellCheck: false,
              style: { fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 },
            }}
            sx={{
              '& .MuiOutlinedInput-root': { alignItems: 'flex-start', borderRadius: 1 },
              '& textarea': { minHeight: { xs: 'calc(100vh - 320px)', md: 'calc(100vh - 260px)' } },
            }}
          />
        </Box>
      </Paper>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={2500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar?.severity ?? 'success'}
          onClose={() => setSnackbar(null)}
          sx={{ width: '100%' }}
        >
          {snackbar?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
