import { createClient } from "@/lib/supabase/server";
import mammoth from "mammoth";

export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });

    if (file.size > 4_000_000 || !file.name.toLowerCase().endsWith(".docx")) return Response.json({ error: "Upload a DOCX file smaller than 4 MB." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (text.length < 10) {
      return Response.json({ error: "Document appears to be empty or unreadable." }, { status: 400 });
    }

    return Response.json({ text });
  } catch (e: any) {
    return Response.json({ error: e.message ?? String(e) }, { status: 500 });
  }
}
