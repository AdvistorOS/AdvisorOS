export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY ?? "MISSING";
  const aai = process.env.ASSEMBLYAI_API_KEY ?? "MISSING";
  return Response.json({
    anthropic_prefix: key.slice(0, 15),
    anthropic_length: key.length,
    assemblyai_prefix: aai.slice(0, 8),
    assemblyai_length: aai.length,
  });
}
