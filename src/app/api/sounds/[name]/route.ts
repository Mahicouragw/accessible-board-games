import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { name: string } }) {
  try {
    const { name } = params;
    if (!/^[a-zA-Z0-9\-_\.\s]+$/.test(name)) {
      return new Response("Invalid file name", { status: 400 });
    }

    // Try multiple possible locations for Vercel compatibility
    const possiblePaths = [
      path.join(process.cwd(), "public", "sounds", name),
      path.join(process.cwd(), "public", "sounds", "realistic", name),
      path.join(process.cwd(), "public", "audio", name),
      path.join(process.cwd(), "public", name),
      path.join(process.cwd(), ".next", "static", "media", name),
      // Vercel specific paths
      path.join("/var/task", "public", "sounds", name),
      path.join("/var/task", "public", "sounds", "realistic", name),
    ];

    for (const filePath of possiblePaths) {
      try {
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
              "Content-Length": data.length.toString(),
            },
          });
        }
      } catch (e) {
        console.error(`Failed to read ${filePath}:`, e);
      }
    }

    // If file not found, try to list available files for debugging (only for test.txt)
    if (name === "test.txt" || name.includes("test")) {
      try {
        const publicDir = path.join(process.cwd(), "public");
        const soundsDir = path.join(publicDir, "sounds");
        let listing = `File not found: ${name}\n\nTried paths:\n${possiblePaths.join("\n")}\n\n`;
        if (fs.existsSync(publicDir)) {
          listing += `\npublic/ exists, contents: ${fs.readdirSync(publicDir).join(", ")}\n`;
        }
        if (fs.existsSync(soundsDir)) {
          listing += `public/sounds/ exists, files: ${fs.readdirSync(soundsDir).slice(0, 20).join(", ")}\n`;
        } else {
          listing += `public/sounds/ DOES NOT EXIST!\n`;
        }
        return new Response(listing, { status: 404, headers: { "Content-Type": "text/plain" } });
      } catch (e) {
        return new Response(`Error listing: ${e}`, { status: 500 });
      }
    }

    return new Response(`Sound file not found: ${name} - Tried ${possiblePaths.length} locations. Ensure file is in public/sounds/ folder.`, { status: 404 });
  } catch (e) {
    console.error("Sound API error:", e);
    return new Response(`Error loading sound: ${e}`, { status: 500 });
  }
}
