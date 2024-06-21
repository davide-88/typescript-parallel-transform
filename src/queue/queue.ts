export interface Queue<T> {
  enqueue(value: T): void;
  dequeue(): T | undefined;
  size(): number;
}
