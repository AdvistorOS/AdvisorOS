import { fileToWav16kMono } from "./audio-wav";

// Extracts a short audio clip for a given speaker from the full recording,
// using their longest single utterance (best signal for matching).
export async function extractSpeakerClip(audioUrl: string, utterances: any[], speakerLabel: string): Promise<Blob | null> {
  const speakerUtterances = utterances.filter((u) => u.speaker === speakerLabel);
  if (!speakerUtterances.length) return null;

  // Pick the longest utterance for the clearest sample, capped at 15s for speed
  const longest = speakerUtterances.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
  const startSec = longest.start / 1000;
  const durationSec = Math.min((longest.end - longest.start) / 1000, 15);

  const res = await fetch(audioUrl);
  const fullBuffer = await res.arrayBuffer();
  const tempCtx = new AudioContext();
  const decoded = await tempCtx.decodeAudioData(fullBuffer);
  tempCtx.close();

  const startSample = Math.floor(startSec * decoded.sampleRate);
  const numSamples = Math.floor(durationSec * decoded.sampleRate);
  const clipBuffer = new AudioContext().createBuffer(1, numSamples, decoded.sampleRate);
  const sourceData = decoded.getChannelData(0);
  const clipData = clipBuffer.getChannelData(0);
  for (let i = 0; i < numSamples; i++) {
    clipData[i] = sourceData[startSample + i] ?? 0;
  }

  // Re-use the same WAV encoder by rendering through OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(durationSec * 16000), 16000);
  const source = offlineCtx.createBufferSource();
  source.buffer = clipBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();

  const dummyBlob = new Blob([]);
  // fileToWav16kMono expects a Blob it can decode — instead, encode directly from `rendered`
  return encodeWavFromBuffer(rendered);
}

function encodeWavFromBuffer(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0);
  const numSamples = data.length;
  const byteRate = 16000 * 2;
  const dataSize = numSamples * 2;
  const arr = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arr);
  function writeString(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }
  writeString(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeString(8, "WAVE");
  writeString(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, byteRate, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(36, "data"); view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([arr], { type: "audio/wav" });
}
