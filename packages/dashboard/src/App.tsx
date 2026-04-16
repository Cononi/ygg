import { createContext, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { buildTheme } from './theme'
import SidebarLayout from './SidebarLayout'
import FullscreenLayout from './FullscreenLayout'
import ManageLayout from './pages/ManageLayout'
import ProjectHome from './pages/ProjectHome'
import ProjectDetail from './pages/ProjectDetail'
import FileEditor from './pages/FileEditor'
import TopicDetail from './pages/TopicDetail'
import ProjectCategories from './pages/ProjectCategories'

export const ColorModeContext = createContext({ toggleColorMode: () => {} })

export default function App() {
  const stored = localStorage.getItem('ygg-theme-mode')
  const [mode, setMode] = useState<'light' | 'dark'>(stored === 'dark' ? 'dark' : 'light')

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode(prev => {
          const next = prev === 'light' ? 'dark' : 'light'
          localStorage.setItem('ygg-theme-mode', next)
          return next
        })
      },
    }),
    [],
  )

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route element={<SidebarLayout />}>
              <Route path="/" element={<ProjectHome />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/manage" element={<ManageLayout />}>
                <Route path="categories" element={<ProjectCategories />} />
              </Route>
            </Route>

            <Route element={<FullscreenLayout />}>
              <Route path="/projects/:id/files/:target/:type/:name" element={<FileEditor />} />
              <Route path="/projects/:id/changes/archive/:archiveTopic" element={<TopicDetail />} />
              <Route path="/projects/:id/changes/:topic" element={<TopicDetail />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
