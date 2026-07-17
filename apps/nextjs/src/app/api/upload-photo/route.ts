import { type NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { writeFileSync, existsSync, mkdirSync } from "fs";

// Increase body size limit for this route to handle base64 photos
export const maxDuration = 60;

function saveBase64Image(base64Data: string): string | null {
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const fileType = matches[1];
    const base64ImageBytes = matches[2];

    let extension = "jpg";
    if (fileType?.includes("png")) extension = "png";
    if (fileType?.includes("webp")) extension = "webp";

    const filename = `incident_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

    let baseDir = process.cwd();
    const monorepoPublicDir = join(baseDir, "apps/nextjs/public");
    if (existsSync(monorepoPublicDir)) {
      baseDir = monorepoPublicDir;
    } else {
      baseDir = join(baseDir, "public");
    }

    const uploadDir = join(baseDir, "uploads");
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, filename);
    writeFileSync(filePath, Buffer.from(base64ImageBytes!, "base64"));

    return `/uploads/${filename}`;
  } catch (err) {
    console.error("[upload-photo] Error saving image:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { base64: string };
    if (!body.base64) {
      return NextResponse.json({ error: "No base64 provided" }, { status: 400 });
    }

    // Try to save to filesystem (works locally and on self-hosted servers)
    const url = saveBase64Image(body.base64);
    if (url) {
      return NextResponse.json({ url });
    }

    // Fallback for serverless environments (Vercel) where filesystem is read-only:
    // Return the base64 data URL directly so the client can store it.
    // The data URL will be stored as finalPhotoUrl in the database and renders
    // correctly via <img src="data:..."> in browsers and React Native Image.
    if (body.base64.startsWith("data:image/")) {
      return NextResponse.json({ url: body.base64 });
    }

    return NextResponse.json({ error: "Failed to save image" }, { status: 500 });
  } catch (err) {
    console.error("[upload-photo] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


// OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
