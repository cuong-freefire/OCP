import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './hooks/useAuth.js';
import HomePage from './pages/HomePage.jsx';
import RoleDashboardPage from './pages/RoleDashboardPage.jsx';
import AuthRoutes from './routes/AuthRoutes.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import './components/auth/authStyles.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/*" element={<AuthRoutes />} />
          <Route
            path="/learner"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <RoleDashboardPage role="LEARNER" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor"
            element={
              <ProtectedRoute allowedRoles={['MENTOR']}>
                <RoleDashboardPage role="MENTOR" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <RoleDashboardPage role="ADMIN" />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" newestOnTop />
    </AuthProvider>
  );
}
