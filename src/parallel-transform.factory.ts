import type { TransformCallback } from 'node:stream';

import { OrderedParallelTransform } from './ordered-parallel-transform.js';
import {
  ParallelTransform,
  type ParallelTransformOptions,
} from './parallel-transform.js';

export type CreateParallelTransformOptions = ParallelTransformOptions & {
  ordered: boolean;
};

export interface AsyncTransform<Input, Output> {
  (input: Input, encoding: BufferEncoding): Promise<Output>;
}

export interface SyncTransform<Input, Output> {
  (input: Input, encoding: BufferEncoding): Output;
}

export type CreatePromisifiedParallelTransformOptions<Input, Output> = Omit<
  ParallelTransformOptions,
  'transform'
> & {
  transform: AsyncTransform<Input, Output> | SyncTransform<Input, Output>;
} & {
  ordered: boolean;
};

export const parallelTransform = ({
  ordered,
  ...options
}: CreateParallelTransformOptions): ParallelTransform =>
  ordered
    ? new OrderedParallelTransform(options)
    : new ParallelTransform(options);

export const promisifiedParallelTransform = <Input, Output>(
  options: CreatePromisifiedParallelTransformOptions<Input, Output>,
): ParallelTransform => {
  const { transform, ...rest } = options;
  return parallelTransform({
    ...rest,
    transform: (
      chunk: Input,
      encoding: BufferEncoding,
      done: TransformCallback,
    ) => {
      try {
        const transformed = transform(chunk, encoding);
        if (transformed instanceof Promise) {
          transformed
            .then(projected => {
              done(null, projected);
            })
            .catch(e => done(e));
          return;
        }
        done(null, transformed);
      } catch (e) {
        done(e as Error | null | undefined);
      }
    },
  });
};
