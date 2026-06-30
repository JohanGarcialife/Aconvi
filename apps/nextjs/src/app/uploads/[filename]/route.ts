import { NextRequest } from "next/server";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ filename: string }> }
) {
  try {
    const params = await props.params;
    const filename = params.filename;

    if (!filename) {
      return new Response("Filename parameter is required", { status: 400 });
    }

    // Resolve path inside standalone container layout
    let baseDir = process.cwd();
    let filePath = join(baseDir, "apps/nextjs/public/uploads", filename);
    
    if (!existsSync(filePath)) {
      filePath = join(baseDir, "public/uploads", filename);
    }

    if (!existsSync(filePath)) {
      console.warn(`[Uploads API] Image file not found: ${filePath}`);
      return new Response("Not Found", { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);
    
    // Determine content type
    let contentType = "image/jpeg";
    if (filename.endsWith(".png")) contentType = "image/png";
    if (filename.endsWith(".webp")) contentType = "image/webp";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[Uploads API] Error serving image file:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
