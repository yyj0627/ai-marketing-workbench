type RoutePreviewProps = {
  entrance: 'www' | 'app' | 'admin'
  title: string
  description: string
}

export function RoutePreview({ entrance, title, description }: RoutePreviewProps) {
  return (
    <main className="route-preview">
      <section className="route-preview__inner">
        <div className="route-preview__eyebrow">{entrance} 入口</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  )
}
