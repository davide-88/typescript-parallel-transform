import { Queue } from './queue.js';

class Node<T> {
  next: Node<T> | undefined = undefined;
  constructor(public readonly value: T) {}
}

export class LinkedListQueue<T> implements Queue<T> {
  private head: Node<T> | undefined = undefined;
  private tail: Node<T> | undefined = undefined;
  private numberOfNodes = 0;

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
}
