export async function GET() {
  const aai = process.env.ASSEMBLYAI_API_KEY ?? "MISSING";
  return Response.json({
    assemblyai_prefix: aai.slice(0, 10),
    assemblyai_length: aai.length,
    assemblyai_full_for_comparison_only: aai,
  });
}
