/**
 * chromeos版の録音は {session_id}/chunk_*.pcm に生PCM（ステレオ interleaved
 * int16, L=オペレーター / R=お客様）で保存される。admin の音声ダウンロード用に、
 * チャンク群を結合して再生可能な WAV を組み立てる。
 *
 * 旧ネイティブ版は mic/speaker を別々の mono WAV で保存していたため mix.ts を
 * 使っていたが、chromeos版はこのモジュールで chunk から直接 WAV を作る。
 */

function buildWavHeader(dataSize: number, sampleRate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = channels * 2; // 16bit
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits/sample
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return header;
}

/** 生PCMチャンク（ArrayBuffer）を結合して1つの Buffer にする。 */
export function concatChunks(chunks: ArrayBuffer[]): Buffer {
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

/** 結合済みステレオPCM(interleaved int16) をそのまま stereo WAV にする。 */
export function buildStereoWav(pcm: Buffer, sampleRate: number): Buffer {
  return Buffer.concat([buildWavHeader(pcm.length, sampleRate, 2), pcm]);
}

/**
 * ステレオ interleaved int16 から指定チャンネル(0=L=オペ / 1=R=客)を抜き出し
 * mono WAV にする。1フレーム = L(2byte) + R(2byte) = 4byte。
 */
export function extractChannelWav(pcm: Buffer, channel: 0 | 1, sampleRate: number): Buffer {
  const frameCount = Math.floor(pcm.length / 4);
  const mono = Buffer.alloc(frameCount * 2);
  const byteInFrame = channel * 2;
  for (let i = 0; i < frameCount; i += 1) {
    mono.writeInt16LE(pcm.readInt16LE(i * 4 + byteInFrame), i * 2);
  }
  return Buffer.concat([buildWavHeader(mono.length, sampleRate, 1), mono]);
}
