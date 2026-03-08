import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { incorrectJoints, avgError, currentStep, accuracyScore } = body;

  const prompt = `You are a helpful physical therapy assistant giving real-time feedback during a rehabilitation exercise.

Current step: "${currentStep}"
Accuracy score: ${accuracyScore}/100
Average joint deviation: ${avgError.toFixed(1)}°
Joints needing correction: ${incorrectJoints.length > 0 ? incorrectJoints.join(', ') : 'none'}

Give ONE short, encouraging sentence of feedback (max 15 words). Be specific about what to fix if there are errors. Be positive if everything is good.`;

  const apiKey = process.env.GEMINI_API_KEY;
  const severity: string = accuracyScore >= 80 ? 'good' : avgError > 20 ? 'error' : 'warn';

  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 60, temperature: 0.7 },
        }),
      });

      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const data = await res.json();
      const message =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Keep going!';

      return NextResponse.json({ message, severity });
    } catch (err) {
      console.error('[PhysioAI] Gemini feedback error:', err);
    }
  }

  // Rule-based fallback (no key set, or API error)
  let message: string;
  if (incorrectJoints.length === 0) {
    message = 'Excellent form! Keep it up.';
  } else if (avgError > 20) {
    message = `Adjust your ${incorrectJoints[0].replace('_', ' ')} to match the guide.`;
  } else {
    message = `Almost perfect — slight adjustment at your ${incorrectJoints[0].replace('_', ' ')}.`;
  }

  return NextResponse.json({ message, severity });
}
