import type { OrganyaSong, OrganyaNote, OrganyaTrack } from "./OrganyaSong"
import { DataReader } from "../utils/DataReader"

export function readOrganyaSong(
  data: ArrayBuffer,
  logger?: (level: "warning" | "error", message: string) => void,
): OrganyaSong {
  const reader = new DataReader(data)
  try {
    const fileSignature = reader.iso88591String(6, "fileSignature")
    const version = fileSignature === "Org-01"
      ? 1
      : fileSignature === "Org-02"
      ? 2
      : fileSignature === "Org-03"
      ? 3
      : throwFileSignatureError(fileSignature)

    const stepDuration = reader.uint16("Song.stepDuration", true)
    if (stepDuration < 1 || stepDuration > 2000) {
      throwOutOfRangeError({ min: 1, max: 2000 }, stepDuration)
    }

    const beatsPerBar = reader.uint8("Song.beatsPerBar")
    if (beatsPerBar < 1 || beatsPerBar > 127) {
      throwOutOfRangeError({ min: 1, max: 127 }, beatsPerBar)
    }

    const stepsPerBeat = reader.uint8("Song.stepsPerBeat")
    if (stepsPerBeat < 1 || stepsPerBeat > 127) {
      throwOutOfRangeError({ min: 1, max: 127 }, stepsPerBeat)
    }

    const repeatStart = reader.int32("Song.repeatStart", true)
    if (repeatStart < 0) {
      warnOutOfRange({ min: 0 }, repeatStart)
    }

    const repeatEnd = reader.int32("Song.repeatEnd", true)
    if (repeatEnd <= repeatStart) {
      throwOutOfRangeError({ min: "Song.repeatStart" }, repeatEnd)
    }
    if (repeatEnd < 0) {
      warnOutOfRange({ min: 0 }, repeatEnd)
    }

    const tracks = Array<MutableTrack>(16)
    for (let i = 0; i < 16; i++) {
      const frequencyShift = reader.uint16("Track.frequencyShift", true)
      if (frequencyShift < 100 || frequencyShift > 1900) {
        warnOutOfRange({ min: 100, max: 1900 }, frequencyShift)
      }

      const instrument = reader.uint8("Track.instrument")
      if (instrument > 99) {
        warnOutOfRange({ max: 99 }, instrument)
      }

      // "Pipi" is only supported since version 2. The field is unused in version 1.
      const pipi = !!reader.uint8("Track.pipi") && version >= 2

      const noteCount = reader.uint16("Track.noteCount", true)
      if (noteCount > 4096) {
        throwOutOfRangeError({ max: 4096 }, noteCount)
      }

      tracks[i] = { instrument, frequencyShift, pipi, notes: Array<MutableNote>(noteCount) }
    }
    for (let i = 0; i < 16; i++) {
      const notes = tracks[i]!.notes
      for (let j = 0; j < notes.length; j++) {
        const start = reader.int32("Note.start", true)
        if (start < 0) {
          warnOutOfRange({ min: 0 }, start)
        }

        notes[j] = { start, pitch: 0, duration: 0, volume: 0, pan: 0 }
      }
      for (let j = 0; j < notes.length; j++) {
        const pitch = reader.uint8("Note.pitch")
        if (pitch > 95 && pitch !== 255) {
          throwOutOfRangeError({ max: 95 }, pitch)
        }

        notes[j]!.pitch = pitch
      }
      for (let j = 0; j < notes.length; j++) {
        const duration = reader.uint8("Note.duration")
        if (duration < 1) {
          warnOutOfRange({ min: 1 }, duration)
        }

        notes[j]!.duration = duration
      }
      for (let j = 0; j < notes.length; j++) {
        const volume = reader.uint8("Note.volume")

        notes[j]!.volume = volume
      }
      for (let j = 0; j < notes.length; j++) {
        const pan = reader.uint8("Note.pan")
        if (pan > 12 && pan !== 255) {
          throwOutOfRangeError({ max: 12 }, pan)
        }

        notes[j]!.pan = pan
      }
    }

    return { stepDuration, stepsPerBeat, beatsPerBar, repeatStart, repeatEnd, tracks }
  }
  catch (e) {
    // Validation error.
    if (e instanceof OrganyaReadError) {
      throw e
    }

    // End of file.
    if (e instanceof RangeError) {
      throwEOFError()
    }

    // Unknown error.
    const message = e instanceof Error ? e.message : "Unknown error."

    throw new OrganyaReadError(`Could not read Organya song: ${message}`)
  }

  function throwFileSignatureError(actualValue: string): never {
    const fileOffset = getReaderCurrentOffsetHex()
    const fieldName = reader.currentFieldName
    // Replace undefined ISO-8859-1 code points with '.'.
    const sanitizedActualValue = actualValue.replace(/[\\x00-\\x1F\\x7F-\\x9F]/, ".")
    const message = `Error reading field ${formatNameOrValue(fieldName)} at file offset ${fileOffset}: Unknown or `
      + `unsupported file signature: ${formatNameOrValue(sanitizedActualValue)}.`

    logger?.("error", message)

    throw new OrganyaReadError(message, { fieldName, fileOffset, actualValue })
  }

  function throwOutOfRangeError(
    range: { min?: string | number, max?: string | number },
    actualValue: number,
  ): never {
    const fileOffset = getReaderCurrentOffsetHex()
    const fieldName = reader.currentFieldName
    const { min, max } = range
    const requirementMessage = min != undefined
      ? max != undefined
        ? `must be between ${formatNameOrValue(min)} and ${formatNameOrValue(max)}`
        : `must not be less than ${formatNameOrValue(min)}`
      : max != undefined
        ? `must not be greater than ${formatNameOrValue(max)}`
        : "outside legal range"
    const message = `Error reading field ${formatNameOrValue(fieldName)} at file offset ${fileOffset}: Value `
      + `${requirementMessage}: ${formatNameOrValue(actualValue)}.`

    logger?.("error", message)

    throw new OrganyaReadError(message, { fieldName, fileOffset, min, max, actualValue })
  }

  function warnOutOfRange(range: { min?: string | number, max?: string | number }, actualValue: number): void {
    const fileOffset = getReaderCurrentOffsetHex()
    const fieldName = reader.currentFieldName
    const { min, max } = range
    const requirementMessage = min != undefined
      ? max != undefined
        ? `should be between ${formatNameOrValue(min)} and ${formatNameOrValue(max)}`
        : `should not be less than ${formatNameOrValue(min)}`
      : max != undefined
        ? `should not be greater than ${formatNameOrValue(max)}`
        : "outside safe range"
    const message
      = `Value of field ${formatNameOrValue(fieldName)} at file offset ${fileOffset} ${requirementMessage}: `
      + `${formatNameOrValue(actualValue)}. Playback may result in unintended behavior.`

    logger?.("warning", message)
  }

  function throwEOFError(): never {
    const fileOffset = getReaderCurrentOffsetHex()
    const fieldName = reader.currentFieldName
    const message = `Error reading field '${fieldName}' at file offset ${fileOffset}: End of file.`

    logger?.("error", message)

    throw new OrganyaReadError(message, { fileOffset, fieldName })
  }

  function getReaderCurrentOffsetHex(): string {
    const offsetBase16 = reader.currentOffset.toString(16).toUpperCase()

    // Pad the number of digits to the next multiple of 2.
    return offsetBase16.padStart(2 + 2 * Math.ceil(offsetBase16.length * 0.5), "0x00")
  }

  function formatNameOrValue(nameOrValue: string | number): string {
    return typeof nameOrValue === "string" ? `'${nameOrValue}'` : nameOrValue.toString()
  }
}

export class OrganyaReadError extends Error {
  readonly fileOffset: string | undefined
  readonly fieldName: string | undefined
  readonly min: string | number | undefined
  readonly max: string | number | undefined
  readonly actualValue: string | number | undefined

  constructor(message?: string, { fileOffset, fieldName, min, max, actualValue }: {
    readonly fileOffset?: string | undefined
    readonly fieldName?: string | undefined
    readonly min?: string | number | undefined
    readonly max?: string | number | undefined
    readonly actualValue?: string | number | undefined
  } = {}) {
    super(message)
    this.fileOffset = fileOffset
    this.fieldName = fieldName
    this.min = min
    this.max = max
    this.actualValue = actualValue
  }
}
Object.defineProperty(OrganyaReadError.prototype, "name", {
  ...Object.getOwnPropertyDescriptor(Error.prototype, "name"),
  value: OrganyaReadError.name,
})

type Mutable<T> = { -readonly [P in keyof T]: T[P] }

type MutableNote = Mutable<OrganyaNote>

type MutableTrack = Mutable<Omit<OrganyaTrack, "notes">> & { notes: MutableNote[] }
