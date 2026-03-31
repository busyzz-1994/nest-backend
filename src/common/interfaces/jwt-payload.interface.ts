export interface JwtPayload {
  userId: number;
  email: string;
  role: 'admin' | 'user';
  menuPermissions: string[];
}
