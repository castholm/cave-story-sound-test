export interface OrganyaSong {
  readonly stepDuration: number
  readonly stepsPerBeat: number
  readonly beatsPerBar: number
  readonly repeatStart: number
  readonly repeatEnd: number
  readonly tracks: readonly OrganyaTrack[]
}

export interface OrganyaTrack {
  readonly instrument: number
  readonly frequencyShift: number
  readonly pipi: boolean
  readonly notes: readonly OrganyaNote[]
}

export interface OrganyaNote {
  readonly start: number
  readonly pitch: number
  readonly duration: number
  readonly volume: number
  readonly pan: number
}
