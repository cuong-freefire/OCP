import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/authApi.js';

const AuthContext = createContext(null);

export const roleDashboardPaths = {
  LEARNER: '/learner',
  MENTOR: '/mentor',
  ADMIN: '/admin',
};

export function getDashboardPathForRole(role) {
  return roleDashboardPaths[String(role || '').toUpperCase()] || '/auth/me';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const commitAuthResponse = useCallback((response) => {
    const nextUser = response.data?.user || null;
    setUser(nextUser);
    return nextUser;
  }, []);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authApi.me();
      return commitAuthResponse(response);
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [commitAuthResponse]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (credentials) => {
      const response = await authApi.login(credentials);
      return commitAuthResponse(response);
    },
    [commitAuthResponse],
  );

  const verifyEmail = useCallback(
    async (payload) => {
      const response = await authApi.verifyEmail(payload);
      return commitAuthResponse(response);
    },
    [commitAuthResponse],
  );

  const loginWithGoogleCredential = useCallback(
    async (credential) => {
      const response = await authApi.googleLogin({ credential });
      return commitAuthResponse(response);
    },
    [commitAuthResponse],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authenticated: Boolean(user),
      reload: loadUser,
      login,
      verifyEmail,
      loginWithGoogleCredential,
      logout,
    }),
    [loadUser, loading, login, loginWithGoogleCredential, logout, user, verifyEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
