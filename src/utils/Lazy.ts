export class Lazy<T> {
  #value: T | undefined
  #factory: () => T

  constructor(factory: () => T) {
    this.#value = undefined
    this.#factory = factory
  }

  get value(): T {
    return this.#value ??= this.#factory()
  }
}
