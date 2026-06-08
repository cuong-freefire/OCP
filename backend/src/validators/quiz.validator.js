import { z } from 'zod';

export const quizIdParamSchema = z.object({
  quizId: z.string().uuid('Quiz ID không hợp lệ.'),
});

export const courseIdParamSchema = z.object({
  courseId: z.string().uuid('Course ID không hợp lệ.'),
});

export const startQuizSchema = z.object({
  quizId: z.string().uuid(),
});

export const submitAnswerSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid('ID câu hỏi không hợp lệ.'),
        selectedOptions: z.array(z.union([z.string(), z.number(), z.boolean()])),
      }),
    )
    .min(1, 'Phải có ít nhất một câu trả lời.'),
});

export const quizListQuerySchema = z.object({
  courseId: z.string().uuid('Course ID không hợp lệ.').optional(),
  lessonId: z.string().uuid('Lesson ID không hợp lệ.').optional(),
});