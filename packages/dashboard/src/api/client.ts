import type { ProjectInfo, ProjectDetail, ProjectEntry, ChangesResponse, TopicDetailResponse, ChangeField } from '../types'

const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    throw new Error(err.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  version: (): Promise<{ version: string }> =>
    fetch(`${BASE}/version`).then(r => json(r)),

  projects: {
    list: (): Promise<{ projects: ProjectInfo[] }> =>
      fetch(`${BASE}/projects`).then(r => json(r)),

    add: (path: string): Promise<{ project: ProjectEntry }> =>
      fetch(`${BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      }).then(r => json(r)),

    remove: (id: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}`, { method: 'DELETE' }).then(r => json(r)),

    update: (id: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/update`, { method: 'POST' }).then(r => json(r)),

    get: (id: string): Promise<ProjectDetail> =>
      fetch(`${BASE}/projects/${id}`).then(r => json(r)),
  },

  files: {
    get: (id: string, target: string, type: string, name: string): Promise<{ content: string; path: string }> =>
      fetch(`${BASE}/projects/${id}/files/${encodeURIComponent(target)}/${type}/${encodeURIComponent(name)}`).then(r => json(r)),

    save: (id: string, target: string, type: string, name: string, content: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/files/${encodeURIComponent(target)}/${type}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).then(r => json(r)),
  },

  changes: {
    list: (id: string): Promise<ChangesResponse> =>
      fetch(`${BASE}/projects/${id}/changes`).then(r => json<ChangesResponse>(r)),

    detail: (id: string, topic: string): Promise<TopicDetailResponse> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}`).then(r => json<TopicDetailResponse>(r)),

    file: (id: string, topic: string, filePath: string): Promise<{ content: string; fileType: 'markdown' | 'json' }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}?file=${encodeURIComponent(filePath)}`).then(r => json(r)),

    patch: (id: string, topic: string, field: ChangeField, value: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      }).then(r => json(r)),

    delete: (id: string, topic: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}`, {
        method: 'DELETE',
      }).then(r => json(r)),

    archive: (id: string, topic: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}/archive`, {
        method: 'POST',
      }).then(r => json(r)),

    restore: (id: string, topic: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(`archive/${topic}`)}/restore`, {
        method: 'POST',
      }).then(r => json(r)),

    saveFile: (id: string, topic: string, filePath: string, content: string): Promise<{ success: boolean }> =>
      fetch(`${BASE}/projects/${id}/changes/${encodeTopicPath(topic)}?file=${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).then(r => json(r)),
  },
}

function encodeTopicPath(topic: string): string {
  return topic.split('/').map(encodeURIComponent).join('/')
}
