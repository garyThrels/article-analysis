import { ArticleEnrichment } from "@carma/shared";

interface Props {
  enrichment: ArticleEnrichment | null;
}

/**
 * Renders an article's LLM enrichment: the AI summary, a colored sentiment
 * badge, and topic chips. When enrichment hasn't completed yet (pending /
 * processing / failed) it shows a small muted status pill instead.
 */
export function EnrichmentView({ enrichment }: Props) {
  if (!enrichment) return null;

  if (enrichment.status !== "completed") {
    return (
      <p className={`enrichment-status enrichment-status-${enrichment.status}`}>
        enrichment: {enrichment.status}
      </p>
    );
  }

  const { summary, sentiment, topics } = enrichment;

  return (
    <div className="enrichment">
      {summary && (
        <p className="enrichment-summary">
          <span className="enrichment-label">AI summary</span>
          {summary}
        </p>
      )}
      <div className="enrichment-tags">
        {sentiment && (
          <span className={`sentiment sentiment-${sentiment}`}>{sentiment}</span>
        )}
        {topics.map((topic) => (
          <span key={topic} className="topic">
            #{topic}
          </span>
        ))}
      </div>
    </div>
  );
}
