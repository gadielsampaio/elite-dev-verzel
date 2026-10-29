import { Skeleton } from "./ui/skeleton";
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
          <Skeleton className="session-skeleton-block session-skeleton-short" />
          <strong>HAUS SAMPAIO</strong>
          <Skeleton className="session-skeleton-block session-skeleton-short" />
        </header>
        <div className="session-skeleton-nav">
          <Skeleton className="session-skeleton-block session-skeleton-line" />
        </div>
        <section className="session-skeleton-hero">
          <div className="session-skeleton-copy">
            <Skeleton className="session-skeleton-block session-skeleton-short" />
            <Skeleton className="session-skeleton-block session-skeleton-title" />
            <Skeleton className="session-skeleton-block session-skeleton-title" />
            <Skeleton className="session-skeleton-block session-skeleton-line" />
            <div className="session-skeleton-meta">
              <Skeleton className="session-skeleton-block" />
              <Skeleton className="session-skeleton-block" />
            </div>
          </div>
          <Skeleton className="session-skeleton-block session-skeleton-art" />
        </section>
        <section className="session-skeleton-catalog">
          <Skeleton className="session-skeleton-block session-skeleton-title" />
          <div className="session-skeleton-filters">
            <Skeleton className="session-skeleton-block session-skeleton-line" />
            <Skeleton className="session-skeleton-block session-skeleton-line" />
          </div>
          <div className="session-skeleton-grid">
            {[0, 1, 2].map((card) => (
              <div key={card}>
                <Skeleton className="session-skeleton-block session-skeleton-card" />
                <Skeleton className="session-skeleton-block session-skeleton-line" />
                <Skeleton className="session-skeleton-block session-skeleton-short" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
