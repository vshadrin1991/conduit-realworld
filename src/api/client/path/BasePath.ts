export enum BasePath {
  USERS = '/users',
  USERS_LOGIN = '/users/login',
  USER = '/user',
  ARTICLES = '/articles',
  ARTICLES_FEED = '/articles/feed',
  ARTICLE = '/articles/{data1}',
  ARTICLE_FAVORITE = '/articles/{data1}/favorite',
  COMMENTS = '/articles/{data1}/comments',
  COMMENT = '/articles/{data1}/comments/{data2}',
  PROFILE_FOLLOW = '/profiles/{data1}/follow',
  TAGS = '/tags',
}

export function buildPath(path: BasePath, ...data: (string | number)[]): string {
  return data.reduce<string>(
    (value, item, index) => value.replace(`{data${index + 1}}`, encodeURIComponent(String(item))),
    path,
  );
}
