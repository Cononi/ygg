import { useContext } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useTheme } from '@mui/material/styles'
import { ColorModeContext } from './App'

export default function FullscreenLayout() {
  const theme = useTheme()
  const { toggleColorMode } = useContext(ColorModeContext)
  const navigate = useNavigate()

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
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton color="inherit" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Detail workspace
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              ygg
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={toggleColorMode}>
            {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Outlet />
    </Box>
  )
}
