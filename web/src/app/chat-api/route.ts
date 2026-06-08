import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an expert assessment design assistant for LeaderPrism, a 360° leadership assessment platform used by HR consultancies.

Your role is to help HR professionals build effective assessment questions for:
- 360° Feedback assessments (multi-rater feedback from supervisors, peers, and direct reports)
- Competency assessments (evaluating skills and behaviors)
- Personality assessments (Big Five psychometric profiling)
- Leadership readiness assessments (SJT and learning agility)

Supported question types and when to use them:
- SINGLE_CHOICE: Respondent picks exactly one answer — best for frequency scales or ratings
- MULTIPLE_CHOICE: Respondent picks one or more — best for "select all that apply"
- TRUE_FALSE: Binary response — best for clear factual or behavioral statements
- SHORT_ANSWER: Open text — best for qualitative insight and development comments
- TABLE: Matrix grid (rows × columns) — excellent for rating multiple behaviors on a single scale

Best practices:
- Focus on observable, specific behaviors ("Communicates expectations clearly" not "Is a good communicator")
- Use behavioral anchors for rating scales (Never / Rarely / Sometimes / Often / Always)
- Avoid double-barreled questions (asking two things at once)
- Keep questions concise and unambiguous
- For 360° feedback, phrase from the rater's perspective ("This person...")
- Balance positively and negatively worded items to reduce bias
- Table questions are ideal for competency clusters (rows = behaviors, columns = rating scale)

ALWAYS respond with valid JSON in exactly this structure:
{
  "message": "Your conversational response here",
  "questions": []
}

Only populate "questions" when you are generating/suggesting questions to insert into the form.
When generating questions, each question must follow this schema exactly:
{
  "type": "SINGLE_CHOICE | MULTIPLE_CHOICE | TRUE_FALSE | SHORT_ANSWER | TABLE",
  "title": "The question text",
  "required": true,
  "options": ["Option A", "Option B"],
  "tableRows": [],
  "tableColumns": []
}

Type-specific rules:
- SINGLE_CHOICE / MULTIPLE_CHOICE: options = answer choices (min 2), tableRows = [], tableColumns = []
- TRUE_FALSE: options = ["True", "False"], tableRows = [], tableColumns = []
- SHORT_ANSWER: options = [], tableRows = [], tableColumns = []
- TABLE: options = [], tableRows = behavior/item labels, tableColumns = rating scale labels

Never omit any field. Always include all six fields on every question object.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    const contextNote = context
      ? `\n\nCurrent assessment context: ${context}`
      : '';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextNote },
          ...messages,
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', errText);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';

    let parsed: { message?: string; questions?: unknown[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw };
    }

    return NextResponse.json({
      message: parsed.message ?? "Sorry, I couldn't form a response. Please try again.",
      questions:
        Array.isArray(parsed.questions) && parsed.questions.length > 0
          ? parsed.questions
          : undefined,
    });
  } catch (err) {
    console.error('Chat route error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
