import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import { resetPasswordFormSchema, validateForm } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateForm(resetPasswordFormSchema, { email, otp, newPassword });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    try {
      await authApi.resetPassword(validation.data);
      showSuccessToast('Đặt lại mật khẩu thành công.');
      navigate('/auth/login');
    } catch (requestError) {
      showErrorToast(requestError);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      footer={
        <div className="auth-switch">
          <Link to="/auth/login">Quay lại đăng nhập</Link>
        </div>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField
          id="otp"
          label="Six-digit code"
          value={otp}
          onChange={setOtp}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
        />
        <TextField
          id="newPassword"
          label="New password"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
        />
        <PrimaryButton>Reset password</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
