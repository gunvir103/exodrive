/**
 * Authentication Type Definitions
 * Type-safe interfaces for authentication-related data
 */

import type { User, Session } from '@supabase/supabase-js';

// Profile query result from Supabase
export interface ProfileQueryResult {
  data: ProfileData | null;
  error: ProfileQueryError | null;
}

export interface ProfileData {
  id: string;
  role: 'admin' | 'user';
  created_at?: string;
  updated_at?: string;
}

export interface ProfileQueryError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

// Auth provider types
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

export interface AuthResult {
  error: Error | null;
  success: boolean;
  user?: User;
  session?: Session;
}

// Admin check result
export interface AdminCheckResult {
  isAdmin: boolean;
  source: 'profile' | 'metadata' | 'cache';
  cached: boolean;
  timestamp: number;
}

// Auth state
export interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: Error | null;
}

// Login form data
export interface LoginFormData {
  email: string;
  password: string;
}

// Signup form data
export interface SignupFormData extends LoginFormData {
  confirmPassword?: string;
}

// Auth error types
export interface AuthError {
  message: string;
  status?: number;
  code?: string;
}