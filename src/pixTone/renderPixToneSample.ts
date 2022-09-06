import type { PixToneParameters } from "./PixToneParameters.js"

let msvcRandomState = 0

function msvcRandom() {
  msvcRandomState = (Math.imul(msvcRandomState, 214013) + 2531011) >>> 0

  return (msvcRandomState >>> 16) & 0x7FFF
}

const WAVEFORMS = [
  // Sine
  new Int8Array(256).map((_, i) => ~~(64 * Math.sin(2 * Math.fround(Math.PI) * i / 256))),
  // Triangle
  new Int8Array(256).map((_, i) => i < 64 ? i : i < 192 ? 128 - i : i - 256),
  // Saw up
  new Int8Array(256).map((_, i) => ~~(i / 2) - 64),
  // Saw down
  new Int8Array(256).map((_, i) => 64 - ~~(i / 2)),
  // Square
  new Int8Array(256).map((_, i) => i < 128 ? 64 : -64),
  // Random
  new Int8Array(256).map(() => ~~((msvcRandom() << 24 >> 24) / 2)),
] as const

const envelopeLUT = new Int8Array(256)

function populateEnvelopeLUT(x0: number, y0: number, x1: number, y1: number): void {
  let y = y0
  const yStep = (y1 - y0) / (x1 - x0)
  for (let x = x0; x < x1; x++) {
    envelopeLUT[x] = ~~y
    y += yStep
  }
}

export function renderPixToneSample(first: PixToneParameters, ...rest: readonly PixToneParameters[]): AudioBuffer {
  const parameters = [first, ...rest]
  const renderBuffer = new Uint8ClampedArray(Math.max(...parameters.map(p => p.size))).fill(128)

  for (const { size, carrier, frequency, amplitude, envelope } of parameters) {
    if (size === 0) {
      continue
    }

    populateEnvelopeLUT(0, envelope.y0, envelope.x1, envelope.y1)
    populateEnvelopeLUT(envelope.x1, envelope.y1, envelope.x2, envelope.y2)
    populateEnvelopeLUT(envelope.x2, envelope.y2, envelope.x3, envelope.y3)
    populateEnvelopeLUT(envelope.x3, envelope.y3, 256, 0)

    let carrierOffset = carrier.offset
    const carrierStep = carrier.frequency !== 0 ? 256 / (size / carrier.frequency) : 0
    const carrierWaveform = WAVEFORMS[carrier.type]!
    let frequencyOffset = frequency.offset
    const frequencyStep = frequency.frequency !== 0 ? 256 / (size / frequency.frequency) : 0
    const frequencyWaveform = WAVEFORMS[frequency.type]!
    let amplitudeOffset = amplitude.offset
    const amplitudeStep = amplitude.frequency !== 0 ? 256 / (size / amplitude.frequency) : 0
    const amplitudeWaveform = WAVEFORMS[amplitude.type]!

    for (let i = 0; i < size; i++) {
      let sample
      sample = carrierWaveform[carrierOffset & 0xFF]! * carrier.amplitude
      sample = ~~(sample / 64)
      sample *= ~~(amplitudeWaveform[amplitudeOffset & 0xFF]! * amplitude.amplitude / 64) + 64
      sample = ~~(sample / 64)
      sample *= envelopeLUT[~~(256 * i / size)]!
      sample = ~~(sample / 64)

      renderBuffer[i] += sample

      const value = frequencyWaveform[frequencyOffset & 0xFF]!
      carrierOffset += carrierStep + 2 ** Math.sign(value) * carrierStep * value * frequency.amplitude / 4096
      frequencyOffset += frequencyStep
      amplitudeOffset += amplitudeStep
    }
  }

  const audioBuffer = new AudioBuffer({ numberOfChannels: 1, length: renderBuffer.length, sampleRate: 22050 })
  const channel0Buffer = audioBuffer.getChannelData(0)
  for (let i = 0; i < renderBuffer.length; i++) {
    channel0Buffer[i] = (renderBuffer[i]! - 128) / 128
  }

  return audioBuffer
}
