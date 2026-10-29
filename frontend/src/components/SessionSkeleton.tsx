import "./session-skeleton.css";

export function SessionSkeleton() {
  return (
    <div
      className="session-skeleton"
      role="status"
      aria-label="Verifying your session"
      aria-busy="true"
    >
      <div aria-hidden="true">
        <header className="session-skeleton-header">
          <span className="session-skeleton-block session-skeleton-short" />
          <strong>HAUS SAMPAIO</strong>
          <span className="session-skeleton-block session-skeleton-short" />
        </header>
        <section className="session-skeleton-hero">
          <div className="session-skeleton-copy">
            <span className="session-skeleton-block session-skeleton-short" />
            <span className="session-skeleton-block session-skeleton-title" />
            <span className="session-skeleton-block session-skeleton-title" />
            <span className="session-skeleton-block session-skeleton-line" />
            <div className="session-skeleton-meta">
              <span className="session-skeleton-block" />
              <span className="session-skeleton-block" />
            </div>
          </div>
          <div className="session-skeleton-block session-skeleton-art" />
        </section>
        <section className="session-skeleton-catalog">
          <span className="session-skeleton-block session-skeleton-title" />
          <div className="session-skeleton-filters">
            <span className="session-skeleton-block session-skeleton-line" />
            <span className="session-skeleton-block session-skeleton-line" />
          </div>
          <div className="session-skeleton-grid">
            {[0, 1, 2].map((card) => (
              <div key={card}>
                <div className="session-skeleton-block session-skeleton-card" />
                <span className="session-skeleton-block session-skeleton-line" />
                <span className="session-skeleton-block session-skeleton-short" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
