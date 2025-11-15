import { Writable, type TransformCallback } from 'node:stream';

export const collect = <Item>(result: Item[]): Writable =>
  new Writable({
    objectMode: true,
    write(chunk: Item, _: BufferEncoding, done: TransformCallback) {
      result.push(chunk);
      done();
    },
  });
