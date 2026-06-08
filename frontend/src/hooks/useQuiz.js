import { useCallback, useRef, useState } from 'react';
import { quizApi } from '../api/quizApi.js';

export function useQuiz() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const autoSaveTimerRef = useRef(null);
  const lastSavedAnswersRef = useRef(null);

  const clearError = useCallback(() => setError(null), []);

  const listQuizzes = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizApi.listQuizzes(params);
      return response.data?.quizzes || [];
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách bài kiểm tra.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const startQuiz = useCallback(async (quizId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizApi.startQuiz(quizId);
      return response.data;
    } catch (err) {
      setError(err.message || 'Không thể bắt đầu bài kiểm tra.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Auto-save with debounce: saves answers after 2s of inactivity.
   */
  const scheduleAutoSave = useCallback(
    (quizId, answers) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Don't re-save if answers haven't changed
      const serialized = JSON.stringify(answers);
      if (lastSavedAnswersRef.current === serialized) return;

      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await quizApi.autoSave(quizId, answers);
          lastSavedAnswersRef.current = serialized;
        } catch {
          // Silent fail for auto-save - don't disrupt user experience
        }
      }, 2000);
    },
    [],
  );

  const submitQuiz = useCallback(async (quizId, answers, startedAt) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizApi.submitQuiz(quizId, answers, startedAt);
      return response.data;
    } catch (err) {
      setError(err.message || 'Không thể nộp bài kiểm tra.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getResult = useCallback(async (submissionId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizApi.getResult(submissionId);
      return response.data;
    } catch (err) {
      setError(err.message || 'Không thể tải kết quả bài kiểm tra.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSubmissionHistory = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const response = await quizApi.getSubmissionHistory(params);
      return response.data?.submissions || [];
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sử bài kiểm tra.');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    listQuizzes,
    startQuiz,
    scheduleAutoSave,
    submitQuiz,
    getResult,
    getSubmissionHistory,
  };
}