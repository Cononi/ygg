import { useContext } from 'react'
import { Outlet } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useTheme } from '@mui/material/styles'
import { ColorModeContext } from './App'
import ProjectSidebar from './components/ProjectSidebar'

const SIDEBAR_WIDTH = 308

export default function SidebarLayout() {
  const theme = useTheme()
  const { toggleColorMode } = useContext(ColorModeContext)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: theme.palette.mode === 'light' ? 'rgba(243,246,251,0.86)' : 'rgba(11,18,32,0.88)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Toolbar sx={{ minHeight: 72, px: { xs: 2, md: 3 } }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.25 }}>
              Operations workspace
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              ygg dashboard
            </Typography>
          </Box>
          <Chip
            label={theme.palette.mode === 'dark' ? 'Dark mode' : 'Light mode'}
            size="small"
            variant="outlined"
            sx={{ mr: 1.5, display: { xs: 'none', sm: 'inline-flex' } }}
          />
          <IconButton color="inherit" onClick={toggleColorMode}>
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: `${SIDEBAR_WIDTH}px minmax(0, 1fr)` },
          gridTemplateRows: { xs: 'auto minmax(0, 1fr)', md: '1fr' },
          gap: 2,
          p: { xs: 1.5, md: 2.5 },
          minHeight: 'calc(100vh - 73px)',
          height: { xs: 'auto', md: 'calc(100vh - 73px)' },
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            maxHeight: { xs: 360, md: 'none' },
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'light'
              ? '0 20px 45px rgba(15, 23, 42, 0.08)'
              : '0 20px 45px rgba(0, 0, 0, 0.28)',
          }}
        >
          <ProjectSidebar />
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: { xs: 420, md: 0 },
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'light'
              ? '0 20px 45px rgba(15, 23, 42, 0.08)'
              : '0 20px 45px rgba(0, 0, 0, 0.28)',
          }}
        >
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <Outlet />
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
