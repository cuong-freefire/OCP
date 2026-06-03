import { Navigate } from 'react-router-dom';
import AuthStatusMessage from '../components/auth/AuthStatusMessage.jsx';
import { getDashboardPathForRole, useAuth } from '../hooks/useAuth.js';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="app-empty-home" aria-label="OCP home">
        <AuthStatusMessage message="Đang kiểm tra phiên đăng nhập..." tone="neutral" />
      </main>
    );
  }

  return <Navigate to={user ? getDashboardPathForRole(user.role) : '/auth/login'} replace />;
}
