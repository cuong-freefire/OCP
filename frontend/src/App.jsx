import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './hooks/useAuth.js';
import HomePage from './pages/HomePage.jsx';
import RoleDashboardPage from './pages/RoleDashboardPage.jsx';
import AuthRoutes from './routes/AuthRoutes.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import QuizListPage from './pages/learner/QuizListPage.jsx';
import QuizTakingPage from './pages/learner/QuizTakingPage.jsx';
import QuizResultPage from './pages/learner/QuizResultPage.jsx';
import QuizHistoryPage from './pages/learner/QuizHistoryPage.jsx';
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
            path="/learner/quizzes"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <QuizListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/quizzes/:quizId/take"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <QuizTakingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/quizzes/:submissionId/result"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <QuizResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learner/quizzes/history"
            element={
              <ProtectedRoute allowedRoles={['LEARNER']}>
                <QuizHistoryPage />
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

          <Route path="/debug/quizzes" element={<QuizListPage />} />
          <Route path="/debug/history" element={<QuizHistoryPage />} />

          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="top-right" newestOnTop />
    </AuthProvider>
  );
}
