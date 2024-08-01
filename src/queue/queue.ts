export abstract class Queue<T> implements Iterable<T> {
  abstract enqueue(value: T): void;
  abstract dequeue(): T | undefined;
  abstract size(): number;
  abstract [Symbol.iterator](): Iterator<T>;
  abstract peek(): T | undefined;
  toArray(): T[] {
    const array: T[] = [];
    for (const value of this) {
      array.push(value);
    }
    return array;
  }
}
