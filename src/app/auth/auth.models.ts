export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface UserResponse {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  tokenType: 'Bearer';
  accessToken: string;
  expiresInSeconds: number;
  user: UserResponse;
}

export interface UpdateProfileRequest {
  name: string;
  email: string;
  phone: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
