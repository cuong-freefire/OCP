import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { SecondaryButton } from '../../components/auth/AuthFormControls.jsx';
import AuthStatusMessage from '../../components/auth/AuthStatusMessage.jsx';
import { useAuth } from '../../hooks/useAuth.js';

export default function CurrentUserPage() {
  const { user, loading, logout } = useAuth();

  return (
    <AuthLayout title="Hồ sơ OCP">
      {loading ? <AuthStatusMessage message="Đang tải hồ sơ..." /> : null}
      {!loading && !user ? <AuthStatusMessage message="Chưa có phiên đăng nhập." tone="error" /> : null}
      {user ? (
        <div className="auth-form">
          <AuthStatusMessage message={`${user.name} · ${user.role}`} tone="success" />
          <div className="auth-status auth-status-neutral">{user.email}</div>
          <SecondaryButton onClick={logout}>Logout</SecondaryButton>
        </div>
      ) : null}
    </AuthLayout>
  );
}
