export interface PixToneParameters {
  readonly size: number
  readonly carrier: PixToneWaveformParameters
  readonly frequency: PixToneWaveformParameters
  readonly amplitude: PixToneWaveformParameters
  readonly envelope: PixToneEnvelopeParameters
}

export interface PixToneWaveformParameters {
  readonly type: number
  readonly frequency: number
  readonly amplitude: number
  readonly offset: number
}

export interface PixToneEnvelopeParameters {
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  readonly x3: number
  readonly y3: number
}
