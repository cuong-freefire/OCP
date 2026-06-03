import { Navigate, useLocation } from 'react-router-dom';
import AuthStatusMessage from '../components/auth/AuthStatusMessage.jsx';
import { getDashboardPathForRole, useAuth } from '../hooks/useAuth.js';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="dashboard-shell">
        <AuthStatusMessage message="Đang kiểm tra phiên đăng nhập..." tone="neutral" />
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  const normalizedRole = String(user.role || '').toUpperCase();
  if (allowedRoles.length > 0 && !allowedRoles.includes(normalizedRole)) {
    return <Navigate to={getDashboardPathForRole(normalizedRole)} replace />;
  }

  return children;
}
