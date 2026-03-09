/**
 * Generates natural, encouraging feedback messages from raw motion error data.
 * Calls the Gemini-backed API server-side via /api/feedback.
 */

export interface FeedbackInput {
  incorrectJoints: string[];
  avgError: number;
  currentStep: string;
  accuracyScore: number;
}

export interface FeedbackResult {
  message: string;
  severity: 'good' | 'warn' | 'error';
}

// Client-side: calls our Next.js API route
export async function generateFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Feedback API error');
    return await res.json();
  } catch {
    // Fallback to rule-based feedback
    return ruleBased(input);
  }
}

function ruleBased(input: FeedbackInput): FeedbackResult {
  const { incorrectJoints, avgError, currentStep } = input;

  if (incorrectJoints.length === 0) {
    return {
      message: `Great form on ${currentStep}—stay steady and keep that same control.`,
      severity: 'good',
    };
  }

  const jointLabel = incorrectJoints[0].replace('_', ' ');
  if (avgError > 20) {
    return {
      message: `Lift your ${jointLabel} slightly and move slower—you’re close, keep going.`,
      severity: 'error',
    };
  }
  return {
    message: `Nice effort—fine-tune your ${jointLabel} and hold the position through the rep.`,
    severity: 'warn',
  };
}
