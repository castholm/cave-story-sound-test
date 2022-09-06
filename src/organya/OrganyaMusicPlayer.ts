import type { OrganyaSong, OrganyaTrack } from "./OrganyaSong.js"

const CHANNEL_COUNT = 16
const MELODY_CHANNEL_COUNT = 8

const IGNORED_NOTE_PROPERTY = 255

const MELODY_OCTAVE_COUNT = 8
const MELODY_PITCH_CLASS_COUNT = 12

const GAIN_RAMP_DURATION_SECONDS = 0.004

const SCHEDULEAHEAD_SECONDS = 1

export class OrganyaMusicPlayer {
  readonly #context: AudioContext

  readonly #melodyAudioBuffers: MelodyAudioBufferMap
  readonly #percussionAudioBuffers: readonly (AudioBuffer | undefined)[]

  readonly #channels: readonly Channel[]

  #song: OrganyaSong | undefined
  #state: "paused" | "playing"

  #contextTimeOffset: number
  #schedulerStep: number
  #timerHandle: number

  constructor(
    context: AudioContext,
    melodyWaveformData: ArrayBuffer,
    percussionSamples: readonly (AudioBuffer | undefined)[],
  ) {
    this.#context = context
    this.#melodyAudioBuffers = new MelodyAudioBufferMap(melodyWaveformData)
    this.#percussionAudioBuffers = percussionSamples

    this.#channels = [...Array(CHANNEL_COUNT).keys()].map<Channel>(i => {
      const volumeNode = context.createGain()
      const panLNode = context.createGain()
      const panRNode = context.createGain()
      volumeNode.connect(panLNode)
      volumeNode.connect(panRNode)
      const mergerNode = context.createChannelMerger(2)
      panLNode.connect(mergerNode, 0, 0)
      panRNode.connect(mergerNode, 0, 1)

      return {
        type: i < MELODY_CHANNEL_COUNT ? "melody" : "percussion",
        volumeNode,
        panLNode,
        panRNode,
        mergerNode,
        track: undefined,
        audioBuffersByOctave: undefined,
        audioBuffer: undefined,
        repeatStartNoteIndex: -1,
        repeatEndNoteIndex: 0,
        nextNoteIndex: -1,
        scheduledSounds: [],
        lastScheduledVolume: 1,
        lastScheduledPanL: 1,
        lastScheduledPanR: 1,
      }
    })

    this.#song = undefined
    this.#state = "paused"

    this.#contextTimeOffset = 0
    this.#schedulerStep = 0
    this.#timerHandle = 0
  }

  get song(): OrganyaSong | undefined {
    return this.#song
  }

  set song(song: OrganyaSong | undefined) {
    const previousState = this.#state
    if (this.#state === "playing") {
      this.pause()
    }

    if (song != undefined) {
      // Initialize channels with relevant constant values derived from the specified song.
      for (let i = 0; i < CHANNEL_COUNT; i++) {
        const channel = this.#channels[i]!
        const track = song.tracks[i]
        if (track != undefined) {
          if (channel.type === "melody") {
            channel.audioBuffersByOctave = this.#melodyAudioBuffers.get(track.instrument, track.pipi)
          } else {
            channel.audioBuffer = this.#percussionAudioBuffers[track.instrument]
          }
          channel.repeatStartNoteIndex = track.notes.findIndex(n => n.start >= song.repeatStart)
          channel.repeatEndNoteIndex = track.notes.findIndex(n => n.start >= song.repeatEnd)
          if (channel.repeatEndNoteIndex === -1) {
            channel.repeatEndNoteIndex = track.notes.length
          }
        }
        channel.track = track
      }
    }

    this.#song = song
    this.#schedulerStep = 0

    if (previousState === "playing") {
      this.play()
    }
  }

  get state(): "paused" | "playing" {
    return this.#state
  }

  get position(): number {
    if (this.#state === "paused" || this.#song == undefined) {
      return this.#schedulerStep
    }

    const stepDurationSeconds = getStepDurationSeconds(this.#song)
    const contextStep = getContextStep(this.#context.currentTime, this.#contextTimeOffset, stepDurationSeconds)

    return boundStep(contextStep, this.#song)
  }

  set position(position: number) {
    const previousState = this.#state
    if (this.#state === "playing") {
      this.pause()
    }

    if (this.#song != undefined) {
      this.#schedulerStep = boundStep(Math.ceil(position), this.#song)
    }
    // If '#song' is undefined, '#scheduledStep' will already have been set to 0.

    if (previousState === "playing") {
      this.play()
    }
  }

  play(): void {
    if (this.#state === "playing") {
      return
    }

    if (this.#song == undefined) {
      this.#state = "playing"

      return
    }

    // Prepare channels to begin scheduling audio events.
    const schedulerStepBounded = boundStep(this.#schedulerStep, this.#song)
    for (const channel of this.#channels) {
      if (channel.track == undefined) {
        continue
      }
      channel.nextNoteIndex = channel.track.notes.findIndex(n => n.start >= schedulerStepBounded)
      if (channel.nextNoteIndex === -1) {
        channel.nextNoteIndex = channel.repeatStartNoteIndex
      }
      channel.lastScheduledVolume = channel.volumeNode.gain.value
      channel.lastScheduledPanL = channel.panLNode.gain.value
      channel.lastScheduledPanR = channel.panRNode.gain.value
    }

    const stepDurationSeconds = getStepDurationSeconds(this.#song)
    this.#contextTimeOffset = this.#context.currentTime - this.#schedulerStep * stepDurationSeconds
    this.#state = "playing"

    this.#timerHandle = setInterval(this.#schedule.bind(this), 1000 * SCHEDULEAHEAD_SECONDS / 2)
    this.#schedule()
  }

  pause(): void {
    if (this.#state === "paused") {
      return
    }

    if (this.#song == undefined) {
      this.#state = "paused"

      return
    }

    // Immediately stop scheduling new audio events.
    clearTimeout(this.#timerHandle)

    // Cancel all previously scheduled audio events.
    const contextTime = this.#context.currentTime
    for (const channel of this.#channels) {
      if (channel.type === "melody") {
        for (const sound of channel.scheduledSounds) {
          if (sound.startTime > contextTime) {
            // The sound has not yet started playing.
            sound.soundNode.stop()
          } else if (sound.endTime > contextTime) {
            // The sound is currently playing (or has already ended), so we stop it by letting it play out to the end
            // of a cycle to prevent a "popping" sound.
            sound.soundNode.loop = false
          }
        }
      } else {
        for (const sound of channel.scheduledSounds) {
          if (sound.startTime > contextTime) {
            // The sound has not yet started playing.
            sound.soundNode.stop()
          }
          // Unlike melody sounds, percussion sounds are fire-and-forget and will always play out in full even if
          // playback is paused, so we don't need to do anything with currently playing sounds.
        }
      }
      channel.scheduledSounds.length = 0 // Clear the array, freeing the objects up for garbage collection.
      channel.volumeNode.gain.cancelScheduledValues(0)
      channel.panLNode.gain.cancelScheduledValues(0)
      channel.panRNode.gain.cancelScheduledValues(0)
    }

    const stepDurationSeconds = getStepDurationSeconds(this.#song)
    const contextStep = getContextStep(contextTime, this.#contextTimeOffset, stepDurationSeconds)
    this.#schedulerStep = boundStep(Math.floor(contextStep) + 1, this.#song)
    this.#state = "paused"
  }

  connect(destinationNode: AudioNode): void {
    for (const channel of this.#channels) {
      channel.mergerNode.connect(destinationNode)
    }
  }

  disconnect(destinationNode?: AudioNode): void {
    for (const channel of this.#channels) {
      if (destinationNode == undefined) {
        channel.mergerNode.disconnect()
      } else {
        channel.mergerNode.disconnect(destinationNode)
      }
    }
  }

  #schedule(): void {
    // Clear previously scheduled sounds that have already ended.
    const contextTime = this.#context.currentTime
    for (const channel of this.#channels) {
      // Because notes are always processed in order, 'channel.scheduledSounds' is naturally always sorted by start
      // time in ascending order, so we only need to find the first not ended (melody) or not started (percussion)
      // sound and clear everything in the array that comes before it.
      if (channel.type === "melody") {
        let firstNotEndedSoundIndex = channel.scheduledSounds.findIndex(s => s.endTime > contextTime)
        if (firstNotEndedSoundIndex === -1) {
          firstNotEndedSoundIndex = channel.scheduledSounds.length // Clear the entire array.
        }
        channel.scheduledSounds.splice(0, firstNotEndedSoundIndex)
      } else {
        let firstNotStartedSoundIndex = channel.scheduledSounds.findIndex(s => s.startTime > contextTime)
        if (firstNotStartedSoundIndex === -1) {
          firstNotStartedSoundIndex = channel.scheduledSounds.length // Clear the entire array.
        }
        channel.scheduledSounds.splice(0, firstNotStartedSoundIndex)
      }
    }

    if (this.#song == undefined) {
      // This should never be reached under normal circumstances.
      return
    }

    // Check if the scheduler is running late and skip ahead to step currently being played back if necessary, so that
    // we don't waste time scheduling audio events that should have already occurred.
    const stepDurationSeconds = getStepDurationSeconds(this.#song)
    const contextStep = getContextStep(contextTime, this.#contextTimeOffset, stepDurationSeconds)
    if (this.#schedulerStep < contextStep) {
      this.#schedulerStep = Math.floor(contextStep)
      const schedulerStepBounded = boundStep(this.#schedulerStep, this.#song)
      for (const channel of this.#channels) {
        if (channel.track == undefined) {
          continue
        }
        channel.nextNoteIndex = channel.track.notes.findIndex(n => n.start >= schedulerStepBounded)
        if (channel.nextNoteIndex === -1) {
          channel.nextNoteIndex = channel.repeatStartNoteIndex
        }
      }
    }

    // Schedule audio events such that the next 'SCHEDULEAHEAD_SECONDS' seconds are fully accounted for.
    while (
      this.#contextTimeOffset + this.#schedulerStep * stepDurationSeconds < contextTime + SCHEDULEAHEAD_SECONDS
    ) {
      const schedulerStepBounded = boundStep(this.#schedulerStep, this.#song)
      for (const channel of this.#channels) {
        const track = channel.track
        if (track == undefined) {
          continue
        }

        const note = track.notes[channel.nextNoteIndex]
        if (note == undefined || note.start !== schedulerStepBounded) {
          continue
        }

        const startTime = this.#contextTimeOffset + this.#schedulerStep * stepDurationSeconds

        if (note.pitch !== IGNORED_NOTE_PROPERTY) {
          if (channel.type === "melody") {
            if (channel.audioBuffersByOctave != undefined) {
              if (channel.scheduledSounds.length > 0) {
                // Stop any previous sound that would have played past the current step.
                const previousSound = channel.scheduledSounds[channel.scheduledSounds.length - 1]!
                if (previousSound.endStep > this.#schedulerStep) {
                  previousSound.endTime = getEndTime(
                    previousSound.soundNode,
                    previousSound.startTime,
                    this.#schedulerStep - previousSound.startStep,
                    stepDurationSeconds,
                  )
                  previousSound.endStep = this.#schedulerStep
                  previousSound.soundNode.stop(previousSound.endTime)
                }
              }

              const soundNode = this.#context.createBufferSource()
              soundNode.connect(channel.volumeNode)
              const octave = ~~(note.pitch / MELODY_PITCH_CLASS_COUNT)
              soundNode.buffer = channel.audioBuffersByOctave[octave]!
              const samplesPerSecond = getSamplesPerSecondMelody(note.pitch, track.frequencyShift)
              soundNode.playbackRate.value = samplesPerSecondToPlaybackRate(
                samplesPerSecond,
                soundNode.buffer.sampleRate,
              )

              soundNode.start(startTime)
              let endTime
              let endStep
              if (track.pipi) {
                endTime = startTime
                endStep = this.#schedulerStep
                soundNode.loop = false
              } else {
                endTime = getEndTime(soundNode, startTime, note.duration, stepDurationSeconds)
                endStep = this.#schedulerStep + note.duration
                soundNode.loop = true
                soundNode.stop(endTime)
              }

              channel.scheduledSounds.push({ soundNode, startTime, endTime, startStep: this.#schedulerStep, endStep })
            }
          } else if (channel.audioBuffer != undefined) {
            const soundNode = this.#context.createBufferSource()
            soundNode.connect(channel.volumeNode)
            soundNode.buffer = channel.audioBuffer
            const samplesPerSecond = getSamplesPerSecondPercussion(note.pitch)
            soundNode.playbackRate.value = samplesPerSecondToPlaybackRate(
              samplesPerSecond,
              soundNode.buffer.sampleRate,
            )

            soundNode.start(startTime)
            soundNode.loop = false

            channel.scheduledSounds.push({ soundNode, startTime })
          }
        }

        if (note.volume !== IGNORED_NOTE_PROPERTY) {
          const volumeMillibels = noteVolumeToMillibels(note.volume)
          const volume = millibelsToGain(volumeMillibels)
          channel.volumeNode.gain.setValueAtTime(channel.lastScheduledVolume, startTime)
          channel.volumeNode.gain.linearRampToValueAtTime(volume, startTime + GAIN_RAMP_DURATION_SECONDS)
          channel.lastScheduledVolume = volume
        }

        if (note.pan !== IGNORED_NOTE_PROPERTY) {
          const panMillibels = notePanToMillibels(note.pan)
          const panL = millibelsToGain(-panMillibels)
          const panR = millibelsToGain(panMillibels)
          channel.panLNode.gain.setValueAtTime(channel.lastScheduledPanL, startTime)
          channel.panRNode.gain.setValueAtTime(channel.lastScheduledPanR, startTime)
          channel.panLNode.gain.linearRampToValueAtTime(panL, startTime + GAIN_RAMP_DURATION_SECONDS)
          channel.panRNode.gain.linearRampToValueAtTime(panR, startTime + GAIN_RAMP_DURATION_SECONDS)
          channel.lastScheduledPanL = panL
          channel.lastScheduledPanR = panR
        }

        channel.nextNoteIndex++
        if (channel.nextNoteIndex >= channel.repeatEndNoteIndex) {
          channel.nextNoteIndex = channel.repeatStartNoteIndex
        }
      }

      this.#schedulerStep++
    }
  }
}

function boundStep(step: number, song: OrganyaSong): number {
  if (step < song.repeatEnd) {
    return step
  }

  return (step - song.repeatStart) % (song.repeatEnd - song.repeatStart) + song.repeatStart
}

function getStepDurationSeconds(song: OrganyaSong): number {
  return song.stepDuration / 1000
}

function getContextStep(contextTime: number, contextTimeOffset: number, stepDurationSeconds: number): number {
  return (contextTime - contextTimeOffset) / stepDurationSeconds
}

/**
* Calculates the end time of a sound such that it plays out to the end of a cycle, to prevent a "popping" sound.
*/
function getEndTime(
  soundNode: AudioBufferSourceNode,
  startTime: number,
  durationSteps: number,
  stepDurationSeconds: number,
): number {
  const periodSeconds = soundNode.buffer!.duration / soundNode.playbackRate.value
  const loopCount = Math.ceil((durationSteps * stepDurationSeconds) / periodSeconds)

  return startTime + loopCount * periodSeconds
}

const MELODY_WAVEFORM_BASE_LENGTHS_BY_OCTAVE = [256, 256, 128, 128, 64, 32, 16, 8] as const
const MELODY_CYCLES_PER_SECOND_BY_PITCH_CLASS = [262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494] as const

function getSamplesPerSecondMelody(notePitch: number, trackFrequencyShift: number): number {
  const octave = ~~(notePitch / MELODY_PITCH_CLASS_COUNT)
  const pitchClass = notePitch % MELODY_PITCH_CLASS_COUNT
  const waveformBaseLength = MELODY_WAVEFORM_BASE_LENGTHS_BY_OCTAVE[octave]!
  const cyclesPerSecond = MELODY_CYCLES_PER_SECOND_BY_PITCH_CLASS[pitchClass]!
  const baseSamplesPerSecond = ~~(2 ** octave * waveformBaseLength * cyclesPerSecond / 8)

  return baseSamplesPerSecond + trackFrequencyShift - 1000
}

function getSamplesPerSecondPercussion(notePitch: number): number {
  return 800 * notePitch + 100
}

function samplesPerSecondToPlaybackRate(samplesPerSecond: number, sampleRate: number): number {
  return 22050 * samplesPerSecond / sampleRate ** 2
}

// 'noteVolumeToMillibels' and 'notePanToMillibels' have been adjusted and simplified slightly and are not 100%
// accurate to the LUT-based implementation used by the original (but should be virtually indistiguishable).

function noteVolumeToMillibels(noteVolume: number): number {
  return 8 * (noteVolume - 254) * (256 / 254)
}

function notePanToMillibels(notePan: number): number {
  return 10 * (notePan - 6) * (256 / 6)
}

function millibelsToGain(millibels: number): number {
  return Math.pow(10, Math.min(millibels, 0) / 2000)
}

const MELODY_WAVEFORM_SOURCE_LENGTH = 256
const MELODY_WAVEFORM_SAMPLE_RATE = 22050

class MelodyAudioBufferMap {
  #waveformData: ArrayBuffer
  #cachedAudioBuffers: Map<number, readonly AudioBuffer[]>

  constructor(waveformData: ArrayBuffer) {
    this.#waveformData = waveformData
    this.#cachedAudioBuffers = new Map()
  }

  get(instrument: number, pipi: boolean): readonly AudioBuffer[] | undefined {
    // 'instrument' is always an integer in the range [0..255].
    const cacheKey = instrument | (pipi ? 256 : 0)
    let audioBuffers = this.#cachedAudioBuffers.get(cacheKey)
    if (audioBuffers == undefined) {
      const byteOffset = MELODY_WAVEFORM_SOURCE_LENGTH * instrument
      if (byteOffset >= 0 && byteOffset + MELODY_WAVEFORM_SOURCE_LENGTH <= this.#waveformData.byteLength) {
        const src = new Int8Array(this.#waveformData, byteOffset, MELODY_WAVEFORM_SOURCE_LENGTH)
        audioBuffers = renderMelodyAudioBuffers(src, pipi)
        this.#cachedAudioBuffers.set(cacheKey, audioBuffers)
      }
    }

    return audioBuffers
  }
}

function renderMelodyAudioBuffers(source: Int8Array, pipi: boolean): readonly AudioBuffer[] {
  const audioBuffers = Array<AudioBuffer>(MELODY_OCTAVE_COUNT)
  for (let octave = 0; octave < MELODY_OCTAVE_COUNT; octave++) {
    const destinationBaseLength = MELODY_WAVEFORM_BASE_LENGTHS_BY_OCTAVE[octave]!
    const destinationLength = pipi ? 4 * (octave + 1) * destinationBaseLength : destinationBaseLength
    const destinationAudioBuffer = new AudioBuffer({
      numberOfChannels: 1,
      length: destinationLength,
      sampleRate: MELODY_WAVEFORM_SAMPLE_RATE,
    })
    const destinationChannel0Buffer = destinationAudioBuffer.getChannelData(0)
    const sourceStep = ~~(MELODY_WAVEFORM_SOURCE_LENGTH / destinationLength)

    let destinationIndex = 0
    let sourceIndex = 0
    while (destinationIndex < destinationLength) {
      destinationChannel0Buffer[destinationIndex] = source[sourceIndex]! / 128
      destinationIndex++
      sourceIndex = (sourceIndex + sourceStep) % MELODY_WAVEFORM_SOURCE_LENGTH
    }

    audioBuffers[octave] = destinationAudioBuffer
  }

  return audioBuffers
}

interface ChannelBase {
  readonly volumeNode: GainNode
  readonly panLNode: GainNode
  readonly panRNode: GainNode
  readonly mergerNode: ChannelMergerNode
  track: OrganyaTrack | undefined
  repeatStartNoteIndex: number // First note after 'repeatStart', or -1.
  repeatEndNoteIndex: number // First note after 'repeatEnd', or 'notes.length'. Always >= 0.
  nextNoteIndex: number
  lastScheduledVolume: number
  lastScheduledPanL: number
  lastScheduledPanR: number
}

interface MelodyChannel extends ChannelBase {
    readonly type: "melody"
    audioBuffersByOctave: readonly AudioBuffer[] | undefined
    readonly scheduledSounds: ScheduledMelodySound[]
}

interface PercussionChannel extends ChannelBase {
    readonly type: "percussion"
    audioBuffer: AudioBuffer | undefined
    readonly scheduledSounds: ScheduledPercussionSound[]
}

type Channel = MelodyChannel | PercussionChannel

interface ScheduledSoundBase {
    readonly soundNode: AudioBufferSourceNode
    readonly startTime: number
}

interface ScheduledMelodySound extends ScheduledSoundBase {
    endTime: number
    readonly startStep: number
    endStep: number
}

interface ScheduledPercussionSound extends ScheduledSoundBase {
}
