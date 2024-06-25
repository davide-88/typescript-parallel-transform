import { Queue } from './queue.js';

class Node<T> {
  next: Node<T> | undefined = undefined;
  constructor(public readonly value: T) {}
}

export class LinkedListQueue<T> extends Queue<T> {
  private head: Node<T> | undefined = undefined;
  private tail: Node<T> | undefined = undefined;
  private numberOfNodes = 0;

  constructor(initial?: T[]) {
    super();
    for (const value of initial ?? []) {
      this.enqueue(value);
    }
  }

  enqueue(value: T): void {
    const node = new Node(value);
    if (this.numberOfNodes === 0) {
      this.head = node;
    } else {
      this.tail!.next = node;
    }
    this.tail = node;
    this.numberOfNodes++;
  }

  dequeue(): T | undefined {
    if (!this.head) {
      return undefined;
    }
    const value = this.head.value;
    this.head = this.head.next;
    this.numberOfNodes--;
    return value;
  }

  size(): number {
    return this.numberOfNodes;
  }

  [Symbol.iterator](): Iterator<T> {
    let current = this.head;
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
