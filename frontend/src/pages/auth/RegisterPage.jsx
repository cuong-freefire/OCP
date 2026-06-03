import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi.js';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { PrimaryButton, TextField } from '../../components/auth/AuthFormControls.jsx';
import { registerFormSchema, validateForm } from '../../utils/authFormSchemas.js';
import { showErrorToast, showSuccessToast } from '../../utils/toastMessages.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateForm(registerFormSchema, { fullName, email, password, confirmPassword });
    if (!validation.success) {
      showErrorToast(validation.message);
      return;
    }

    const { data } = validation;
    setSubmitting(true);
    try {
      await authApi.register({ fullName: data.fullName, email: data.email, password: data.password });
      showSuccessToast('Đã gửi mã xác thực.');
      navigate('/auth/verify-email', { state: { email: data.email, verificationSentAt: Date.now() } });
    } catch (requestError) {
      showErrorToast(requestError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your learner account"
      footer={
        <div className="auth-switch">
          <span>Đã có tài khoản?</span>
          <Link to="/auth/login">Đăng nhập</Link>
        </div>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField id="fullName" label="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <TextField id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <TextField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
        <PrimaryButton disabled={submitting}>Register</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
