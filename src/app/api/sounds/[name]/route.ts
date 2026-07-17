import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { name: string } }) {
  try {
    const { name } = params;
    // Security: only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9\-_\.]+$/.test(name)) {
      return new Response("Invalid file name", { status: 400 });
    }

    // Try multiple locations
    const possiblePaths = [
      path.join(process.cwd(), "public", "sounds", name),
      path.join(process.cwd(), "public", "sounds", "realistic", name),
      path.join(process.cwd(), "public", "audio", name),
      path.join(process.cwd(), "public", name),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let contentType = "audio/wav";
        if (ext === ".mp3") contentType = "audio/mpeg";
        else if (ext === ".ogg") contentType = "audio/ogg";
        else if (ext === ".m4a") contentType = "audio/mp4";
        else if (ext === ".wav") contentType = "audio/wav";
        else if (ext === ".txt") contentType = "text/plain";

        return new Response(data, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    return new Response(`Sound file not found: ${name}`, { status: 404 });
  } catch (e) {
    console.error("Sound API error:", e);
    return new Response("Error loading sound", { status: 500 });
  }
}
