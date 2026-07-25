
import { includes, indexOf, splice, values } from 'bind:Array'
import { get, set, delete as weakMapDelete } from 'bind:WeakMap'

const swap = (arr: any[], a: number, b: number) => {
  const tmp = arr[a]
  arr[a] = arr[b]
  arr[b] = tmp
}

export class SortedMap<K extends WeakKey, V> extends Map<K, V> {
  #score = new WeakMap<K, number>()
  #list: K[] = []
  constructor() {
    super()
  }
  override set(key: K, value: V): this {
    if (!includes(this.#list, key)) {
      this.#list[this.#list.length] = key
      set(this.#score, key, 0)
    }
    return super.set(key, value)
  }
  override delete(key: K): boolean {
    const index = indexOf(this.#list, key)
    if (index >= 0) {
      splice(this.#list, index, 1)
    }
    const a = weakMapDelete(this.#score, key)
    const b = super.delete(key)
    return a && b
  }
  getScore(key: K): number | undefined {
    return get(this.#score, key)
  }
  addScore(key: K, value: number): void {
    const score = this.#score, list = this.#list
    let index = indexOf(list, key)
    if (index < 0) { return }
    set(score, key, (get(score, key) ?? 0) + value)
    if (value > 0) {
      while (index > 0 && (get(score, list[index - 1]) ?? 0) < (get(score, list[index]) ?? 0)) {
        swap(list, index - 1, index)
        index--
      }
    } else if (value < 0) {
      const maxIndex = list.length - 1
      while (index < maxIndex && (get(score, list[index]) ?? 0) < (get(score, list[index + 1]) ?? 0)) {
        swap(list, index, index + 1)
        index++
      }
    }
  }
  override keys(): MapIterator<K> {
    return values(this.#list)
  }
}
