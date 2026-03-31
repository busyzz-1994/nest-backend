export const MENU_KEYS = {
  DASHBOARD: 'dashboard',
  POSTS: 'posts',
  PROFILE: 'profile',
  PERMISSIONS: 'permissions', // 管理员专用
} as const;

export const ALL_MENUS = Object.values(MENU_KEYS);

export type MenuKey = (typeof MENU_KEYS)[keyof typeof MENU_KEYS];
