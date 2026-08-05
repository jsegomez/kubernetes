import { useState, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api/'

const FEATURES = [
  {
    icon: '⚙️',
    title: 'Orquestación con Kubernetes',
    desc: 'Despliega, escala y gestiona contenedores de forma automática con Kubernetes como orquestador principal.',
  },
  {
    icon: '🐳',
    title: 'Contenedores Docker',
    desc: 'Empaqueta aplicaciones en imágenes ligeras y portables que corren igual en cualquier entorno.',
  },
  {
    icon: '⚡',
    title: 'Alta Disponibilidad',
    desc: 'Arquitectura diseñada para tolerar fallos y garantizar que tu servicio siempre esté en línea.',
  },
  {
    icon: '🔄',
    title: 'Escalado Automático',
    desc: 'El HPA de Kubernetes ajusta las réplicas según la carga real, sin intervención manual.',
  },
  {
    icon: '🛡️',
    title: 'Seguridad por Capas',
    desc: 'Network Policies, RBAC y Secrets mantienen tu clúster protegido desde el inicio.',
  },
  {
    icon: '📊',
    title: 'Observabilidad',
    desc: 'Métricas con Prometheus, dashboards en Grafana y trazas distribuidas para visibilidad total.',
  },
]

const STACK = ['Go', 'React', 'Docker', 'Kubernetes', 'Nginx', 'Vite']

function StatusBadge({ status }) {
  const map = {
    loading: { label: 'Conectando…', cls: 'badge badge--loading' },
    ok: { label: 'Backend en línea', cls: 'badge badge--ok' },
    error: { label: 'Sin conexión', cls: 'badge badge--error' },
  }
  const { label, cls } = map[status]
  return <span className={cls}>{label}</span>
}

export default function App() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchData = async () => {
    setStatus('loading')
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const json = await res.json()
      setData(json)
      setStatus('ok')
      setLastRefresh(new Date().toLocaleTimeString('es-ES'))
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 10000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="layout">
      {/* Header */}
      <header className="header">
        <div className="header__inner">
          <div className="header__brand">
            <span className="header__logo">☸️</span>
            <span className="header__title">K8s Lab</span>
          </div>
          <nav className="header__nav">
            <a href="#estado">Estado</a>
            <a href="#features">Features</a>
            <a href="#stack">Stack</a>
          </nav>
        </div>
      </header>

      <main className="main">
        {/* Hero */}
        <section className="hero">
          <div className="hero__glow" />
          <p className="hero__eyebrow">Laboratorio · Kubernetes 01</p>
          <h1 className="hero__heading">
            Microservicios<br />
            <span className="gradient-text">listos para producción</span>
          </h1>
          <p className="hero__sub">
            Frontend React + Backend Go corriendo como pods en un clúster de Kubernetes.
            Observa la respuesta en tiempo real del servicio backend.
          </p>
        </section>

        {/* API Card */}
        <section id="estado" className="section">
          <h2 className="section__title">Estado del Backend</h2>
          <div className="api-card">
            <div className="api-card__header">
              <StatusBadge status={status} />
              {lastRefresh && (
                <span className="api-card__refresh">Última actualización: {lastRefresh}</span>
              )}
            </div>

            {status === 'loading' && (
              <div className="api-card__placeholder">
                <div className="skeleton skeleton--wide" />
                <div className="skeleton skeleton--narrow" />
              </div>
            )}

            {status === 'ok' && data && (
              <div className="api-card__body">
                <div className="api-field">
                  <span className="api-field__key">mensaje</span>
                  <span className="api-field__value api-field__value--highlight">{data.mensaje}</span>
                </div>
                <div className="api-field">
                  <span className="api-field__key">fecha_hora</span>
                  <span className="api-field__value">{data.fecha_hora}</span>
                </div>
                <div className="api-field">
                  <span className="api-field__key">endpoint</span>
                  <span className="api-field__value api-field__value--code">{API_URL}</span>
                </div>
              </div>
            )}

            {status === 'error' && (
              <p className="api-card__error">
                No se pudo contactar al backend. Verifica que el pod esté corriendo y que el Service esté expuesto correctamente.
              </p>
            )}

            <button className="btn" onClick={fetchData} disabled={status === 'loading'}>
              {status === 'loading' ? 'Consultando…' : '↺ Actualizar ahora'}
            </button>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="section">
          <h2 className="section__title">¿Qué exploramos en este lab?</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <span className="card__icon">{f.icon}</span>
                <h3 className="card__title">{f.title}</h3>
                <p className="card__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section id="stack" className="section">
          <h2 className="section__title">Stack tecnológico</h2>
          <div className="stack">
            {STACK.map((s) => (
              <span key={s} className="stack__tag">{s}</span>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Laboratorio Kubernetes · 2026 · Construido con React + Go</p>
      </footer>
    </div>
  )
}
