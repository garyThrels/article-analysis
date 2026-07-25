import { Article } from "@carma/shared";

interface Props {
  article: Article;
}

export function ArticleListItem({ article }: Props) {
  return (
    <li key={article.id} className="article">
      <h2>{article.title}</h2>
      <p>{article.body}</p>
      <time dateTime={article.createdAt}>
        {new Date(article.createdAt).toLocaleString()}
      </time>
    </li>
  );
}
