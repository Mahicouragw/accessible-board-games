#!/usr/bin/env node
/**
 * Generate realistic game sound effects as WAV files
 * Uses PCM synthesis to create more realistic sounds than simple tones
 * Saves to public/sounds/ folder
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function writeWavFile(filename, samples) {
  const outDir = path.join(__dirname, '../public/sounds');
  fs.mkdirSync(outDir, { recursive: true });
  
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * 2;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  
  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(sample * 32767), offset);
    offset += 2;
  }
  
  fs.writeFileSync(path.join(outDir, filename), buffer);
  console.log(`✅ Created ${filename} (${(dataSize/1024).toFixed(1)}KB)`);
}

function generateDiceRoll() {
  // Realistic dice shake: multiple rattles with noise + envelope
  const duration = 0.8;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  
  for (let j = 0; j < 6; j++) {
    const start = Math.floor((j / 6) * length * 0.8);
    const burstLen = Math.floor(SAMPLE_RATE * 0.08);
    for (let i = 0; i < burstLen; i++) {
      if (start + i >= length) break;
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t * 20) * (1 - Math.exp(-t * 200));
      const noise = (Math.random() * 2 - 1) * 0.5;
      const tone = Math.sin(2 * Math.PI * (200 + Math.random() * 800) * t) * 0.3;
      samples[start + i] += (noise + tone) * envelope * 0.6;
    }
  }
  // Final thud
  const thudStart = Math.floor(length * 0.85);
  for (let i = 0; i < SAMPLE_RATE * 0.15; i++) {
    if (thudStart + i >= length) break;
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 8);
    samples[thudStart + i] += Math.sin(2 * Math.PI * 80 * t) * envelope * 0.4;
  }
  
  return samples;
}

function generateTokenMove() {
  // Wooden token tap: short click with wood resonance
  const duration = 0.15;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 40) * (1 - Math.exp(-t * 500));
    const woodResonance = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 20) * 0.3 +
                          Math.sin(2 * Math.PI * 350 * t) * Math.exp(-t * 30) * 0.2 +
                          Math.sin(2 * Math.PI * 700 * t) * Math.exp(-t * 50) * 0.1;
    const click = i < 100 ? (Math.random() * 2 - 1) * 0.8 * Math.exp(-i/20) : 0;
    samples[i] = (woodResonance + click) * envelope;
  }
  return samples;
}

function generateCapture() {
  // Pop + thud for capture
  const duration = 0.3;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const popEnvelope = Math.exp(-t * 15) * (1 - Math.exp(-t * 1000));
    const pop = Math.sin(2 * Math.PI * 150 * t) * popEnvelope * 0.6;
    const thud = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 10) * 0.4;
    const crack = i < 500 ? (Math.random() * 2 - 1) * 0.3 * Math.exp(-t * 100) : 0;
    samples[i] = pop + thud + crack;
  }
  return samples;
}

function generateWin() {
  // Fanfare: C E G C (major arpeggio)
  const duration = 1.2;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const notes = [261.63, 329.63, 392.00, 523.25]; // C4 E4 G4 C5
  
  notes.forEach((freq, idx) => {
    const start = Math.floor((idx * 0.25) * SAMPLE_RATE);
    const noteLength = Math.floor(SAMPLE_RATE * 0.35);
    for (let i = 0; i < noteLength; i++) {
      if (start + i >= length) break;
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t * 2) * (1 - Math.exp(-t * 50));
      const vibrato = 1 + Math.sin(2 * Math.PI * 5 * t) * 0.02;
      const brass = Math.sin(2 * Math.PI * freq * vibrato * t) * 0.4 +
                    Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 +
                    Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
      samples[start + i] += brass * envelope * 0.5;
    }
  });
  return samples;
}

function generateLose() {
  // Sad trombone: descending
  const duration = 1.0;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const notes = [392.00, 349.23, 329.63, 261.63]; // G F E C descending
  
  notes.forEach((freq, idx) => {
    const start = Math.floor((idx * 0.2) * SAMPLE_RATE);
    const noteLength = Math.floor(SAMPLE_RATE * 0.4);
    for (let i = 0; i < noteLength; i++) {
      if (start + i >= length) break;
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t * 1.5) * (1 - Math.exp(-t * 20));
      const slide = freq * (1 - t * 0.1); // slight slide down
      samples[start + i] += Math.sin(2 * Math.PI * slide * t) * envelope * 0.4;
    }
  });
  return samples;
}

function generateLadder() {
  // Ascending harp glissando
  const duration = 1.0;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major scale up
  
  notes.forEach((freq, idx) => {
    const start = Math.floor((idx * 0.12) * SAMPLE_RATE);
    const noteLength = Math.floor(SAMPLE_RATE * 0.3);
    for (let i = 0; i < noteLength; i++) {
      if (start + i >= length) break;
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-t * 3) * (1 - Math.exp(-t * 100));
      const harp = Math.sin(2 * Math.PI * freq * t) * 0.5 +
                   Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 +
                   Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
      samples[start + i] += harp * envelope * 0.4;
    }
  });
  return samples;
}

function generateSnake() {
  // Descending hiss + slide whistle
  const duration = 1.0;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 1.2);
    const slideFreq = 800 - t * 500; // descending from 800 to 300
    const whistle = Math.sin(2 * Math.PI * slideFreq * t) * envelope * 0.3;
    const hiss = (Math.random() * 2 - 1) * 0.1 * envelope;
    const vibrato = Math.sin(2 * Math.PI * 20 * t) * 0.1;
    samples[i] = whistle * (1 + vibrato) + hiss;
  }
  return samples;
}

function generateClick() {
  // UI click
  const duration = 0.08;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 80);
    samples[i] = Math.sin(2 * Math.PI * 800 * t) * envelope * 0.5;
  }
  return samples;
}

function generateBackgroundMusic() {
  // Lo-fi loop: 8 seconds
  const duration = 8.0;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  
  const chords = [
    [261.63, 329.63, 392.00], // C major
    [293.66, 349.23, 440.00], // D minor
    [329.63, 392.00, 493.88], // E minor
    [349.23, 440.00, 523.25], // F major
  ];
  
  const tempo = 0.85; // seconds per chord
  
  for (let chordIdx = 0; chordIdx < 8; chordIdx++) {
    const chord = chords[chordIdx % chords.length];
    const start = Math.floor(chordIdx * tempo * SAMPLE_RATE);
    
    chord.forEach((freq, noteIdx) => {
      const noteStart = start + Math.floor(noteIdx * 0.05 * SAMPLE_RATE);
      const noteLen = Math.floor(SAMPLE_RATE * 0.7);
      for (let i = 0; i < noteLen; i++) {
        if (noteStart + i >= length) break;
        const t = i / SAMPLE_RATE;
        const envelope = Math.exp(-t * 1.2) * (1 - Math.exp(-t * 10));
        const note = Math.sin(2 * Math.PI * freq * t) * 0.15 +
                     Math.sin(2 * Math.PI * freq * 2 * t) * 0.05;
        samples[noteStart + i] += note * envelope;
      }
    });
    
    // Bass
    const bassFreq = chord[0] / 2;
    for (let i = 0; i < Math.floor(SAMPLE_RATE * tempo); i++) {
      if (start + i >= length) break;
      const t = i / SAMPLE_RATE;
      const envelope = 0.3 * Math.exp(-t * 0.5);
      samples[start + i] += Math.sin(2 * Math.PI * bassFreq * t) * envelope * 0.2;
    }
  }
  
  return samples;
}

function main() {
  console.log('🎵 Generating realistic game sound effects...');
  
  writeWavFile('dice-roll.wav', generateDiceRoll());
  writeWavFile('token-move.wav', generateTokenMove());
  writeWavFile('capture.wav', generateCapture());
  writeWavFile('win.wav', generateWin());
  writeWavFile('lose.wav', generateLose());
  writeWavFile('ladder.wav', generateLadder());
  writeWavFile('snake.wav', generateSnake());
  writeWavFile('click.wav', generateClick());
  writeWavFile('select.wav', generateTokenMove()); // reuse
  writeWavFile('turn.wav', generateClick());
  writeWavFile('background-music.wav', generateBackgroundMusic());
  
  // Also create MP3 versions via copy (WAV will work as audio, browser can play WAV)
  // For compatibility, also create .mp3 placeholder that points to WAV (browsers will try)
  
  console.log('🎉 Realistic sound effects generated in public/sounds/');
  console.log('Files: dice-roll, token-move, capture, win, lose, ladder, snake, click, background-music');
}

main();
