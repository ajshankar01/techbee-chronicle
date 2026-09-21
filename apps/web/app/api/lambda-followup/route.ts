import { NextRequest, NextResponse } from "next/server";

// Server-side proxy → AIInterviewFollowUp Lambda (avoids browser CORS)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Guard: Lambda requires non-empty question AND answer
    const question = (body.question || "").trim();
    const answer = (body.answer || "").trim();
    const candidateName = (body.candidate_name || "the candidate").trim();

    if (!question) {
      return NextResponse.json({ followUpQuestion: "" }, { status: 200 });
    }

    // If answer is empty (candidate hasn't spoken yet), use a placeholder
    // so Lambda doesn't reject with "question or answer missing"
    const safeAnswer = answer || "The candidate provided a verbal response.";

    const lambdaUrl = process.env.NEXT_PUBLIC_LAMBDA_FOLLOWUP_URL ||
      "https://fen4jaqpsg.execute-api.ap-southeast-2.amazonaws.com/prod";

    const lambdaRes = await fetch(lambdaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        answer: safeAnswer,
        candidate_name: candidateName, // ← forward real name to Lambda GPT prompt
      }),
    });

    if (!lambdaRes.ok) {
      const errorText = await lambdaRes.text();
      console.error("[Lambda Proxy] Lambda returned error:", lambdaRes.status, errorText);
      return NextResponse.json(
        { error: `Lambda error: ${lambdaRes.status}` },
        { status: lambdaRes.status }
      );
    }

    const data = await lambdaRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Lambda Proxy] Failed to call Lambda:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
