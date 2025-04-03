export interface User {
  id: string;
  email: string;
  role: string;
}

export interface AuthContext {
  token: string;
  user: User;
} 