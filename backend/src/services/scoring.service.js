export class ScoringService {
  /**
   * Score a set of answers against the quiz questions.
   * @param {Array} questions - Quiz questions with correctAnswer, questionType, points
   * @param {Array} answers - User answers [{ questionId, selectedOptions }]
   * @returns {{ score: number, maxScore: number, details: Array }}
   */
  score(questions, answers) {
    let score = 0;
    let maxScore = 0;
    const details = [];

    const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptions]));

    for (const question of questions) {
      maxScore += question.points;
      const selected = answerMap.get(question.id);

      if (!selected) {
        details.push({
          questionId: question.id,
          correct: false,
          points: 0,
          maxPoints: question.points,
          message: 'Chưa trả lời.',
        });
        continue;
      }

      const isCorrect = this._isAnswerCorrect(question, selected);
      if (isCorrect) {
        score += question.points;
      }

      details.push({
        questionId: question.id,
        correct: isCorrect,
        points: isCorrect ? question.points : 0,
        maxPoints: question.points,
      });
    }

    return { score, maxScore, details };
  }

  /**
   * Check if selected options are correct for the given question type.
   */
  _isAnswerCorrect(question, selected) {
    const correct = this._normalizeAnswer(question.correctAnswer);
    const userAnswer = this._normalizeAnswer(selected);

    switch (question.questionType) {
      case 'single_choice':
        return userAnswer.length === 1 && userAnswer[0] === correct[0];

      case 'true_false':
        return userAnswer.length === 1 && String(userAnswer[0]).toLowerCase() === String(correct[0]).toLowerCase();

      case 'multiple_choice': {
        if (userAnswer.length !== correct.length) return false;
        const sortedUser = [...userAnswer].sort();
        const sortedCorrect = [...correct].sort();
        return sortedUser.every((val, idx) => val === sortedCorrect[idx]);
      }

      default:
        return false;
    }
  }

  /**
   * Normalize answer to a sorted array of strings for comparison.
   */
  _normalizeAnswer(answer) {
    if (answer === null || answer === undefined) return [];
    if (Array.isArray(answer)) return answer.map((a) => String(a).trim());
    return [String(answer).trim()];
  }

  /**
   * Determine if the score meets the passing threshold.
   * @param {number} score
   * @param {number} maxScore
   * @param {number} passingScore - percentage threshold (0-100)
   * @returns {boolean}
   */
  isPassed(score, maxScore, passingScore) {
    if (maxScore <= 0) return false;
    return (score / maxScore) * 100 >= passingScore;
  }
}