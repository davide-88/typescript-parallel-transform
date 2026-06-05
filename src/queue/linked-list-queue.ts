import { Queue } from './queue.ts';

class Node<T> {
  readonly value: T;
  next: Node<T> | undefined = undefined;
  constructor(value: T) {
    this.value = value;
  }
}

export class LinkedListQueue<T> extends Queue<T> {
  #head: Node<T> | undefined = undefined;
  #tail: Node<T> | undefined = undefined;
  #numberOfNodes = 0;

  constructor(initial?: T[]) {
    super();
    for (const value of initial ?? []) {
      this.enqueue(value);
    }
  }

  enqueue(value: T): void {
    const node = new Node(value);
    if (this.#numberOfNodes === 0) {
      this.#head = node;
    } else {
      this.#tail!.next = node;
    }
    this.#tail = node;
    this.#numberOfNodes++;
  }

  dequeue(): T | undefined {
    if (!this.#head) {
      return undefined;
    }
    const value = this.#head.value;
    this.#head = this.#head.next;
    this.#numberOfNodes--;
    return value;
  }

  peek(): T | undefined {
    return this.#head?.value;
  }

  size(): number {
    return this.#numberOfNodes;
  }

  clear(): void {
    this.#head = undefined;
    this.#tail = undefined;
    this.#numberOfNodes = 0;
  }

  [Symbol.iterator](): Iterator<T> {
    let current = this.#head;
    return {
      next(): IteratorResult<T> {
        if (!current) {
          return { done: true, value: undefined };
        }
        const value = current.value;
        current = current.next;
        return { done: false, value };
      },
    };
  }
}
