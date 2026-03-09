import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { incorrectJoints, avgError, currentStep, accuracyScore } = body;

  const firstJoint = incorrectJoints?.[0]?.replace('_', ' ') || 'movement';

  const prompt = `You are a helpful physical therapy assistant giving real-time feedback during a rehabilitation exercise.

Current step: "${currentStep}"
Accuracy score: ${accuracyScore}/100
Average joint deviation: ${avgError.toFixed(1)}°
Joints needing correction: ${incorrectJoints.length > 0 ? incorrectJoints.join(', ') : 'none'}

Return exactly ONE short motivational coaching sentence (10-18 words).
Rules:
- Keep it concise and specific.
- If errors exist, name one joint and one clear action cue.
- End with encouragement.
- Do not use emojis, numbering, or quotes.

Examples of style (not content to copy):
- "Lift your right elbow slightly and rotate slower—you’re very close, keep going."
- "Great alignment this rep; stay steady through your shoulder and finish strong."`;

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
      const rawMessage = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? 'Keep going!';
      const sentence = rawMessage.split(/[\n.!?]/).find((line: string) => line.trim().length > 0)?.trim() || rawMessage;
      const message = sentence.length > 140 ? `${sentence.slice(0, 137).trim()}...` : sentence;

      return NextResponse.json({ message, severity });
    } catch (err) {
      console.error('[PhysioAI] Gemini feedback error:', err);
    }
  }

  // Rule-based fallback (no key set, or API error)
  let message: string;
  if (incorrectJoints.length === 0) {
    message = `Great control on ${currentStep}—stay smooth and confident, you are doing well.`;
  } else if (avgError > 20) {
    message = `Adjust your ${firstJoint} a little and move slower—you’re close, keep pushing.`;
  } else {
    message = `Nice effort—fine-tune your ${firstJoint} and hold that line to finish strong.`;
  }

  return NextResponse.json({ message, severity });
}
