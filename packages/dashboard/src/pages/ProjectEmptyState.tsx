import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

export default function ProjectEmptyState() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100%' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Dashboard overview
          </Typography>
          <Typography variant="h4" sx={{ mb: 1 }}>
            ygg operations center
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
            프로젝트를 선택하면 버전 상태, 활성 change, 완료 이력, target 기반 파일 소스를 한눈에 볼 수 있습니다.
            왼쪽 패널에서 프로젝트를 선택하거나 새 프로젝트를 추가해 시작하세요.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {[
            ['Project control', '프로젝트 버전과 ygg CLI 상태를 동시에 추적합니다.'],
            ['Completed history', 'archive 완료 항목을 버전, latest, 날짜 기준으로 확인합니다.'],
            ['Target-aware files', 'Claude, Codex, 이후 추가될 타깃 파일 구조를 같은 화면에서 탐색합니다.'],
          ].map(([title, body]) => (
            <Grid key={title} xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 1, height: '100%' }}>
                <Chip size="small" label={title} sx={{ mb: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  {body}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  )
}
