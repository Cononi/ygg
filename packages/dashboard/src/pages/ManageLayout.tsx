import { Link as RouterLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

const MANAGE_ITEMS = [
  {
    label: 'Categories',
    to: '/manage/categories',
    description: '프로젝트 분류를 만들고, 이름을 바꾸고, 정리합니다.',
  },
]

export default function ManageLayout() {
  const location = useLocation()

  if (location.pathname === '/manage' || location.pathname === '/manage/') {
    return <Navigate to="/manage/categories" replace />
  }

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Typography variant="overline" color="text.secondary">
          Operations
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
          Operations
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>
          프로젝트 운영에 필요한 항목을 한 곳에서 관리합니다. 현재는 카테고리 구조와 이동 흐름을 여기서 다룹니다.
        </Typography>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' },
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1 }}>
              Operations
            </Typography>
            {MANAGE_ITEMS.map(item => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                color="inherit"
                sx={{
                  justifyContent: 'flex-start',
                  px: 1.25,
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  bgcolor: location.pathname.startsWith(item.to) ? 'action.selected' : 'transparent',
                }}
              >
                <Box>
                  <Typography variant="subtitle2">{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        </Paper>

        <Outlet />
      </Box>
    </Stack>
  )
}
