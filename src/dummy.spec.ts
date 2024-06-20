// @ts-expect-error: typings declaration for the `node:assert` built-in module is not yet available.
import { equal } from 'node:assert/strict';
// @ts-expect-error: typings declaration for the `node:assert` built-in module is not yet available.
import { describe, it } from 'node:test';

import { add } from './dummy.js';

describe('Given add', () => {
  it('should add 1 + 1 to 2', () => {
    equal(add(1, 1), 2);
  });
});
