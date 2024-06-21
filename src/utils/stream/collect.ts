import { Writable, type TransformCallback } from 'node:stream';

export const collect = (result: never[]): Writable =>
  new Writable({
    objectMode: true,
    write(chunk: never, _: BufferEncoding, done: TransformCallback) {
      result.push(chunk);
      done();
    },
  });
