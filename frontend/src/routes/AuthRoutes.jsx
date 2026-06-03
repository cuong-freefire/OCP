import { Navigate, Route, Routes } from 'react-router-dom';
import CurrentUserPage from '../pages/auth/CurrentUserPage.jsx';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.jsx';
import SetPasswordPage from '../pages/auth/SetPasswordPage.jsx';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage.jsx';

export default function AuthRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="set-password" element={<SetPasswordPage />} />
      <Route path="me" element={<CurrentUserPage />} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
