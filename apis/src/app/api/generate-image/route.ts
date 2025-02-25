import { prompts } from "@/lib/imagePrompts";
import { leap } from "@/lib/leap";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

if (!process.env.INSERT_IMAGE_WEBHOOK_URL) {
  throw new Error("Missing env var: INSERT_IMAGE_WEBHOOK_URL");
}
//  Check that INSERT_IMAGE_WEBHOOK_URL is a valid URL
try {
  new URL(process.env.INSERT_IMAGE_WEBHOOK_URL);
} catch (error) {
  throw new Error("Invalid env var: INSERT_IMAGE_WEBHOOK_URL");
}

// Cannot use edge since it doesn't support XMLHttpRequest
export const runtime = "nodejs";
export const revalidate = 0;

function getRandomPrompt() {
  return prompts[Math.floor(Math.random() * prompts.length)];
}

export async function GET(request: Request) {
  const prompt = getRandomPrompt();
  const jobId = randomUUID();
  const negativePrompt =
    "blurry, lowres, ugly, boring, poor lighting, dull, unclear, duplicate, error, low quality, out of frame, watermark, signature, double faces, two people, multiple people";

  const { data, error } = await leap.generate.createInferenceJob({
    prompt,
    negativePrompt,
    numberOfImages: 1,
    webhookUrl: `${process.env.INSERT_IMAGE_WEBHOOK_URL}?device=desktop&jobId=${jobId}`,
    height: 576,
    width: 1024,
    upscaleBy: "x2",
    steps: 60,
  });

  if (error || !data) {
    console.error(error);
    return NextResponse.json(
      {
        error,
        message: "Error generating desktop image",
      },
      {
        status: 500,
      }
    );
  }

  const { data: mobileData, error: mobileError } =
    await leap.generate.createInferenceJob({
      prompt,
      negativePrompt,
      numberOfImages: 1,
      webhookUrl: `${process.env.INSERT_IMAGE_WEBHOOK_URL}?device=mobile&jobId=${jobId}`,
      width: 576,
      height: 1024,
      upscaleBy: "x2",
      steps: 60,
      seed: (await data).seed,
    });

  if (error || mobileError) {
    console.error(error);
    console.error(mobileError);
    return NextResponse.json(
      {
        error,
        message: "Error generating mobile image",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    data,
    mobileData,
  });
}
