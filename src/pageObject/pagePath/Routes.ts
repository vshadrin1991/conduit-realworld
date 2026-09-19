export const Route = {
  home: '/',
  login: '/login',
  register: '/register',
  settings: '/settings',
  newArticle: '/editor',
  editArticle: (slug: string) => `/editor/${slug}`,
  article: (slug: string) => `/article/${slug}`,
  profile: (username: string) => `/profile/${username}`,
  profileFavorites: (username: string) => `/profile/${username}/favorites`,
} as const;
