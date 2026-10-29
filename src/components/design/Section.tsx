import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  title: string
  intro?: ReactNode
  children: ReactNode
}

export function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section id={`ds-${id}`} className="ds-section" aria-labelledby={`ds-${id}-title`}>
      <h3 id={`ds-${id}-title`}>{title}</h3>
      {intro && <p className="ds-lead">{intro}</p>}
      {children}
    </section>
  )
}

export function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ds-sub">
      <h4>{title}</h4>
      {children}
    </div>
  )
}
