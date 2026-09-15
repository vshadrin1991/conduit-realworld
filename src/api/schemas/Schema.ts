import article from './articles/article.schema.json';
import articles from './articles/articles.schema.json';
import comment from './comments/comment.schema.json';
import comments from './comments/comments.schema.json';
import error from './errors/error.schema.json';
import profile from './profiles/profile.schema.json';
import user from './users/user.schema.json';

/**
 * JSON schemas of the API responses, one file per model in `src/api/schemas/<domain>/`. Each entry describes what the
 * matching endpoint helper returns: `ARTICLES` the whole list response, `COMMENTS` the array of comments.
 * Use them in tests through the `toMatchSchema` matcher: `expect(article).toMatchSchema(Schema.ARTICLE)`.
 */
export const Schema = {
  ARTICLE: article,
  ARTICLES: articles,
  COMMENT: comment,
  COMMENTS: comments,
  PROFILE: profile,
  USER: user,
  ERROR: error,
} as const;

export type JsonSchema = (typeof Schema)[keyof typeof Schema];
