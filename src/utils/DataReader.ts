export class DataReader {
  #dataView: DataView
  #currentOffset: number
  #currentFieldName: string
  #currentValue: string | number | undefined
  #nextOffset: number

  constructor(buffer: ArrayBuffer) {
    this.#dataView = new DataView(buffer)
    this.#currentOffset = 0
    this.#currentFieldName = ""
    this.#currentValue = undefined
    this.#nextOffset = 0
  }

  get currentOffset(): number {
    return this.#currentOffset
  }

  get currentFieldName(): string {
    return this.#currentFieldName
  }

  get currentValue(): string | number | undefined {
    return this.#currentValue
  }

  get nextOffset(): number {
    return this.#nextOffset
  }

  int8(fieldName: string): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getInt8(this.#currentOffset)
    this.#nextOffset += 1

    return this.#currentValue
  }

  uint8(fieldName: string): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getUint8(this.#currentOffset)
    this.#nextOffset += 1

    return this.#currentValue
  }

  int16(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getInt16(this.#currentOffset, littleEndian)
    this.#nextOffset += 2

    return this.#currentValue
  }

  uint16(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getUint16(this.#currentOffset, littleEndian)
    this.#nextOffset += 2

    return this.#currentValue
  }

  int32(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getInt32(this.#currentOffset, littleEndian)
    this.#nextOffset += 4

    return this.#currentValue
  }

  uint32(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getUint32(this.#currentOffset, littleEndian)
    this.#nextOffset += 4

    return this.#currentValue
  }

  float32(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getFloat32(this.#currentOffset, littleEndian)
    this.#nextOffset += 4

    return this.#currentValue
  }

  float64(fieldName: string, littleEndian?: boolean): number {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    this.#currentValue = this.#dataView.getFloat64(this.#currentOffset, littleEndian)
    this.#nextOffset += 8

    return this.#currentValue
  }

  iso88591String(length: number, fieldName: string): string {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    void this.#dataView.getUint8(this.#currentOffset + length - 1) // Throws a 'RangeError' if out of bounds.
    this.#currentValue = String.fromCharCode(...new Uint8Array(this.#dataView.buffer.slice(
      this.#currentOffset,
      this.#currentOffset + length,
    )))
    this.#nextOffset += length

    return this.#currentValue
  }

  padding(size: number, fieldName: string): void {
    this.#currentOffset = this.#nextOffset
    this.#currentFieldName = fieldName
    this.#currentValue = undefined
    void this.#dataView.getUint8(this.#currentOffset + size - 1) // Throws a 'RangeError' if out of bounds.
    this.#nextOffset += size
  }
}
