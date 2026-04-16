import { useContext } from 'react'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import { useTheme } from '@mui/material/styles'

import { ColorModeContext } from './App'

export default function SidebarLayout() {
  const theme = useTheme()
  const { toggleColorMode } = useContext(ColorModeContext)
  const location = useLocation()

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
              Workspace hub
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              ygg dashboard
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mr: 1.5 }}>
            <Button
              component={RouterLink}
              to="/"
              size="small"
              color="inherit"
              variant={location.pathname === '/' ? 'contained' : 'text'}
            >
              Projects
            </Button>
            <Button
              component={RouterLink}
              to="/manage/categories"
              size="small"
              color="inherit"
              variant={location.pathname.startsWith('/manage') ? 'contained' : 'text'}
            >
              Operations
            </Button>
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

      <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
