import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import 'highlight.js/styles/github.css'

const markdownSx: SxProps<Theme> = theme => ({
  p: 2,
  color: 'text.primary',
  lineHeight: 1.7,
  '& > :first-of-type': {
    mt: 0,
  },
  '& > :last-child': {
    mb: 0,
  },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: 'text.primary',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    mt: 2.5,
    mb: 1,
  },
  '& p, & ul, & ol, & blockquote, & pre': {
    my: 1.25,
  },
  '& ul, & ol': {
    pl: 3,
  },
  '& li + li': {
    mt: 0.5,
  },
  '& a': {
    color: 'primary.main',
  },
  '& hr': {
    border: 0,
    borderTop: '1px solid',
    borderColor: 'divider',
    my: 2,
  },
  '& blockquote': {
    m: 0,
    px: 1.5,
    py: 1,
    borderLeft: '4px solid',
    borderColor: 'primary.light',
    bgcolor: 'action.hover',
    color: 'text.secondary',
  },
  '& :not(pre) > code': {
    px: 0.75,
    py: 0.2,
    borderRadius: 1,
    bgcolor: 'action.hover',
    color: 'secondary.main',
    fontFamily: 'Monaco, Consolas, monospace',
    fontSize: '0.9em',
  },
  '& pre': {
    overflowX: 'auto',
    p: 1.5,
    borderRadius: 1,
    bgcolor: theme.palette.mode === 'light' ? '#f6f8fa' : '#0f1726',
    border: '1px solid',
    borderColor: 'divider',
  },
  '& pre code': {
    fontFamily: 'Monaco, Consolas, monospace',
    fontSize: '0.85rem',
    backgroundColor: 'transparent !important',
    padding: '0 !important',
  },
  '& table': {
    width: '100%',
    minWidth: 420,
    borderCollapse: 'collapse',
    my: 1.5,
    fontSize: '0.95rem',
  },
  '& thead': {
    bgcolor: 'action.hover',
  },
  '& th, & td': {
    border: '1px solid',
    borderColor: 'divider',
    px: 1.25,
    py: 0.9,
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '& th': {
    fontWeight: 700,
    color: 'text.primary',
  },
  '& tr:nth-of-type(even) td': {
    bgcolor: theme.palette.mode === 'light' ? '#fbfcfe' : '#111827',
  },
  '& img': {
    maxWidth: '100%',
  },
  '& .markdown-table-wrap': {
    width: '100%',
    overflowX: 'auto',
  },
  '& .hljs': {
    background: 'transparent',
  },
})

export function MarkdownRenderer({
  content,
  sx,
}: {
  content: string
  sx?: SxProps<Theme>
}) {
  return (
    <Box sx={[markdownSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          table: ({ node: _node, ...props }) => (
            <Box className="markdown-table-wrap">
              <Box component="table" {...props} />
            </Box>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
}
