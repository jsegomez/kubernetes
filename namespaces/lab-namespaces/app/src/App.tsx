import { useState } from 'react'
import './App.css'

type Status = 'Active' | 'Terminating'

interface Namespace {
  name: string
  status: Status
  pods: number
  cpu: string
  memory: string
  age: string
  labels: string[]
}

const namespaces: Namespace[] = [
  { name: 'default', status: 'Active', pods: 3, cpu: '250m', memory: '128Mi', age: '14d', labels: ['env=lab'] },
  { name: 'kube-system', status: 'Active', pods: 12, cpu: '800m', memory: '512Mi', age: '14d', labels: ['tier=system'] },
  { name: 'kube-public', status: 'Active', pods: 0, cpu: '0', memory: '0', age: '14d', labels: ['tier=system'] },
  { name: 'monitoring', status: 'Active', pods: 5, cpu: '400m', memory: '256Mi', age: '7d', labels: ['env=ops', 'app=monitoring'] },
  { name: 'dev', status: 'Active', pods: 8, cpu: '600m', memory: '384Mi', age: '5d', labels: ['env=dev', 'team=backend'] },
  { name: 'staging', status: 'Active', pods: 6, cpu: '500m', memory: '320Mi', age: '3d', labels: ['env=staging'] },
  { name: 'production', status: 'Active', pods: 15, cpu: '2000m', memory: '1Gi', age: '1d', labels: ['env=prod', 'tier=critical'] },
  { name: 'lab-tools', status: 'Terminating', pods: 1, cpu: '100m', memory: '64Mi', age: '2h', labels: ['env=lab'] },
]

const statusColor: Record<Status, string> = {
  Active: 'status-active',
  Terminating: 'status-terminating',
}

const envColor: Record<string, string> = {
  'env=prod': 'tag-prod',
  'tier=critical': 'tag-prod',
  'env=staging': 'tag-staging',
  'env=dev': 'tag-dev',
  'env=lab': 'tag-lab',
  'env=ops': 'tag-ops',
  'tier=system': 'tag-system',
}

export default function App() {
  const [selected, setSelected] = useState<Namespace | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'system'>('all')

  const filtered = namespaces.filter(ns => {
    if (filter === 'active') return ns.pods > 0
    if (filter === 'system') return ns.name.startsWith('kube-')
    return true
  })

  const totalPods = namespaces.reduce((s, ns) => s + ns.pods, 0)
  const activeNs = namespaces.filter(ns => ns.status === 'Active').length

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <svg className="k8s-logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 4L28 10.5V21.5L16 28L4 21.5V10.5L16 4Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="16" cy="16" r="3" fill="currentColor" />
            <line x1="16" y1="13" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" />
            <line x1="16" y1="19" x2="16" y2="25" stroke="currentColor" strokeWidth="1.5" />
            <line x1="13.4" y1="14.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="18.6" y1="17.5" x2="24" y2="20.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="18.6" y1="14.5" x2="24" y2="11.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="13.4" y1="17.5" x2="8" y2="20.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div>
            <h1>Namespace Lab</h1>
            <span className="cluster-name">cluster: minikube-lab</span>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-value">{namespaces.length}</span>
            <span className="stat-label">Namespaces</span>
          </div>
          <div className="stat">
            <span className="stat-value">{activeNs}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalPods}</span>
            <span className="stat-label">Total Pods</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="toolbar">
          <div className="filters">
            {(['all', 'active', 'system'] as const).map(f => (
              <button
                key={f}
                className={`filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <code className="kubectl-hint">kubectl get namespaces</code>
        </div>

        <div className="grid">
          {filtered.map(ns => (
            <button
              key={ns.name}
              className={`ns-card ${selected?.name === ns.name ? 'selected' : ''}`}
              onClick={() => setSelected(prev => prev?.name === ns.name ? null : ns)}
            >
              <div className="ns-card-top">
                <span className="ns-icon">⬡</span>
                <span className={`status-badge ${statusColor[ns.status]}`}>{ns.status}</span>
              </div>
              <div className="ns-name">{ns.name}</div>
              <div className="ns-meta">
                <span>{ns.pods} pods</span>
                <span className="sep">·</span>
                <span>{ns.age} old</span>
              </div>
              <div className="ns-tags">
                {ns.labels.map(l => (
                  <span key={l} className={`tag ${envColor[l] ?? 'tag-default'}`}>{l}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="detail-panel">
            <div className="detail-header">
              <h2><span className="mono">ns/</span>{selected.name}</h2>
              <button className="close-btn" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">STATUS</span>
                <span className={`status-badge ${statusColor[selected.status]}`}>{selected.status}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">PODS</span>
                <span className="detail-value">{selected.pods}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">CPU REQUEST</span>
                <span className="detail-value mono">{selected.cpu}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">MEMORY REQUEST</span>
                <span className="detail-value mono">{selected.memory}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">AGE</span>
                <span className="detail-value">{selected.age}</span>
              </div>
              <div className="detail-item full">
                <span className="detail-label">LABELS</span>
                <div className="ns-tags">
                  {selected.labels.map(l => (
                    <span key={l} className={`tag ${envColor[l] ?? 'tag-default'}`}>{l}</span>
                  ))}
                </div>
              </div>
              <div className="detail-item full">
                <span className="detail-label">DESCRIBE</span>
                <pre className="code-block">kubectl describe namespace {selected.name}</pre>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Kubernetes Namespace Lab · <code>v1.31</code></span>
      </footer>
    </div>
  )
}
