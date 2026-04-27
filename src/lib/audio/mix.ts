/**
 * Mix two PCM 16-bit mono WAV files into a single WAV by sample-wise addition.
 *
 * Native Host downsamples both tracks to 16kHz/mono before upload, so we can
 * assume identical format. We still validate headers and pad the shorter track
 * with silence so a length mismatch doesn't truncate the result.
 */

const RIFF = 0x46464952; // "RIFF"
const WAVE = 0x45564157; // "WAVE"
const FMT_ = 0x20746d66; // "fmt "
const DATA = 0x61746164; // "data"

type WavParts = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcm: Int16Array;
};

function parseWav(buffer: ArrayBuffer): WavParts {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== RIFF) throw new Error("not a RIFF file");
  if (view.getUint32(8, true) !== WAVE) throw new Error("not a WAVE file");

  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < view.byteLength) {
    const chunkId = view.getUint32(offset, true);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === FMT_) {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === DATA) {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (!dataOffset || !sampleRate) throw new Error("malformed wav: missing fmt/data");
  if (bitsPerSample !== 16) throw new Error(`unsupported bits/sample: ${bitsPerSample}`);
  if (channels !== 1) throw new Error(`unsupported channels: ${channels}`);

  const sampleCount = dataSize / 2;
  const pcm = new Int16Array(buffer, dataOffset, sampleCount);
  return { sampleRate, channels, bitsPerSample, pcm };
}

function clampInt16(value: number): number {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value;
}

function buildWav(pcm: Int16Array, sampleRate: number): Buffer {
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write("RIFF", 0, 4, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, 4, "ascii");
  // fmt chunk
  buffer.write("fmt ", 12, 4, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits/sample
  // data chunk
  buffer.write("data", 36, 4, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  // PCM samples (LE)
  for (let i = 0; i < pcm.length; i += 1) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }
  return buffer;
}

export function mixMonoWavs(micBuffer: ArrayBuffer, speakerBuffer: ArrayBuffer): Buffer {
  const mic = parseWav(micBuffer);
  const spk = parseWav(speakerBuffer);
  if (mic.sampleRate !== spk.sampleRate) {
    throw new Error(`sample rate mismatch: mic=${mic.sampleRate} speaker=${spk.sampleRate}`);
  }
  const length = Math.max(mic.pcm.length, spk.pcm.length);
  const mixed = new Int16Array(length);
  for (let i = 0; i < length; i += 1) {
    const a = i < mic.pcm.length ? mic.pcm[i] : 0;
    const b = i < spk.pcm.length ? spk.pcm[i] : 0;
    // Halve each channel before sum to avoid clipping when both are loud.
    mixed[i] = clampInt16(Math.round(a / 2 + b / 2));
  }
  return buildWav(mixed, mic.sampleRate);
}
