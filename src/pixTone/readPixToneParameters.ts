import type { PixToneParameters, PixToneWaveformParameters } from "./PixToneParameters"
import { DataReader } from "../utils/DataReader"

export function readPixToneParameters(data: ArrayBuffer): PixToneParameters[] {
  const parameters: PixToneParameters[] = []

  // TODO: This function could be improved by performing some primitive validation (or not).

  const reader = new DataReader(data)
  try {
    while (reader.nextOffset < data.byteLength) {
      const enabled = !!reader.int32("Parameters.enabled", true)
      const size = reader.int32("Parameters.size", true)

      const waveformParameters = Array<PixToneWaveformParameters>(3)
      for (let i = 0; i < 3; i++) {
        const type = reader.int32("WaveformParameters.type", true)
        reader.padding(4, "(padding)")
        const frequency = reader.float64("WaveformParameters.frequency", true)
        const amplitude = reader.int32("WaveformParameters.amplitude", true)
        const offset = reader.int32("WaveformParameters.offset", true)
        waveformParameters[i] = { type, frequency, amplitude, offset }
      }

      const y0 = reader.int32("EnvelopeParameters.y0", true)
      const x1 = reader.int32("EnvelopeParameters.x1", true)
      const y1 = reader.int32("EnvelopeParameters.y1", true)
      const x2 = reader.int32("EnvelopeParameters.x2", true)
      const y2 = reader.int32("EnvelopeParameters.y2", true)
      const x3 = reader.int32("EnvelopeParameters.x3", true)
      const y3 = reader.int32("EnvelopeParameters.y3", true)
      reader.padding(4, "(padding)")

      if (enabled) {
        parameters.push({
          size,
          carrier: waveformParameters[0]!,
          frequency: waveformParameters[1]!,
          amplitude: waveformParameters[2]!,
          envelope: { y0, x1, y1, x2, y2, x3, y3 },
        })
      }
    }

    return parameters
  } catch (e) {
    // End of file.
    if (e instanceof RangeError) {
      throwEOFError()
    }

    // Unknown error.
    const message = e instanceof Error ? e.message : "Unknown error."

    throw new PixToneReadError(`Could not read PixTone parameters: ${message}`)
  }

  function throwEOFError(): never {
    const fileOffset = getReaderCurrentOffsetHex()
    const fieldName = reader.currentFieldName
    const message = `Error reading field '${fieldName}' at file offset ${fileOffset}: End of file.`

    throw new PixToneReadError(message, { fileOffset, fieldName })
  }

  function getReaderCurrentOffsetHex(): string {
    const offsetBase16 = reader.currentOffset.toString(16).toUpperCase()

    // Pad the number of digits to the next multiple of 2.
    return offsetBase16.padStart(2 + 2 * Math.ceil(offsetBase16.length * 0.5), "0x00")
  }
}

export class PixToneReadError extends Error {
  readonly fileOffset: string | undefined
  readonly fieldName: string | undefined

  constructor(message?: string, { fileOffset, fieldName }: {
    readonly fileOffset?: string | undefined
    readonly fieldName?: string | undefined
  } = {}) {
    super(message)
    this.fileOffset = fileOffset
    this.fieldName = fieldName
  }
}
Object.defineProperty(PixToneReadError.prototype, "name", {
  ...Object.getOwnPropertyDescriptor(Error.prototype, "name"),
  value: PixToneReadError.name,
})
