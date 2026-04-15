import { createTheme, type Theme } from '@mui/material/styles'

export function buildTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
    shape: {
      borderRadius: 5,
    },
    palette: {
      mode,
      primary: { main: '#3f51b5' },
      secondary: { main: '#7c4dff' },
      background: {
        default: mode === 'light' ? '#f3f6fb' : '#0b1220',
        paper: mode === 'light' ? '#ffffff' : '#111827',
      },
      divider: mode === 'light' ? '#dbe3f0' : '#243046',
      text: {
        primary: mode === 'light' ? '#10203a' : '#e6edf8',
        secondary: mode === 'light' ? '#5f6f89' : '#98a6c3',
      },
    },
    typography: {
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 5,
          },
        },
      },
    },
  })
}
