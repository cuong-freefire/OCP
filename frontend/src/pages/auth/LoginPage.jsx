import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton.jsx';
import { getDashboardPathForRole, useAuth } from '../../hooks/useAuth.js';
import { loginFormSchema, validateForm } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogleCredential } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateForm(loginFormSchema, { email, password });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(validation.data);
      showSuccessToast('Đăng nhập thành công.');
      navigate(getDashboardPathForRole(user?.role), { replace: true });
    } catch (requestError) {
      showErrorToast(requestError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = (user) => {
    showSuccessToast('Đăng nhập thành công.');
    navigate(getDashboardPathForRole(user?.role), { replace: true });
  };

  return (
    <AuthLayout
      title="Sign in to OCP"
      footer={
        <div className="auth-switch">
          <span>Chưa có tài khoản?</span>
          <Link to="/auth/register">Đăng ký</Link>
        </div>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <div className="auth-secondary-actions">
          <Link to="/auth/forgot-password">Quên mật khẩu?</Link>
        </div>
        <PrimaryButton disabled={submitting}>Login</PrimaryButton>
        <GoogleSignInButton
          loginWithCredential={loginWithGoogleCredential}
          onSuccess={handleGoogleSuccess}
          onError={showErrorToast}
        />
      </form>
    </AuthLayout>
  );
}
