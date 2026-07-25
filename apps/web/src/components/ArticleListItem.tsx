import { Article } from "@carma/shared";

interface Props {
  article: Article;
}

export function ArticleListItem({ article }: Props) {
  return (
    <li className="article">
      <h2>{article.headline}</h2>
      <p>{article.body}</p>
      <div className="article-meta">
        <span className="source">{article.source}</span>
        {article.publishedAt && (
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleString()}
          </time>
        )}
      </div>
    </li>
  );
}
