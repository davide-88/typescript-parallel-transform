# typescript-parallel-transform

A typescript first implementation of a Node.js
[Transform stream](https://nodejs.org/api/stream.html#class-streamtransform)
with concurrency control.

## Install

To install middy you can use NPM:

```bash
npm install --save @dvd-88/typescript-parallel-transform
```

## Usage

There are two main classes that extends the Node.js Transform stream and allows
you to control the concurrency of the stream in this package:

- `ParallelTransform`: the order of the data is not preserved. Data is pushed to
  the next step as soon as it is available.
- `OrderedParallelTransform`: the order of the data is preserved. Data is pushed
  to the next step in the same order as the chunk it originates from was
  received.

### ParallelTransform

Usage example: [Parallel Transform](src/examples/parallel-transform.ts)

```bash
npx tsx src/examples/parallel-transform.ts
```

Running this example will output something similar to this:

```
Elapsed time: 1004.164841ms
Result: [
  10, 9, 8, 7, 6,
   5, 4, 3, 2, 1
]
```

The elapsed time is around 1 second because it processed 10 items concurrently
(the default max concurrency is 16) and the slowest took 1 second to be
processed. Moreover the order of the items in the result array is reversed since
the computational time of each item is inversely proportional to its value and
the input array is sorted in ascending order.

### ParallelTransform

Usage example:
[Ordered parallel Transform](src/examples/ordered-parallel-transform.ts)

```bash
npx tsx src/examples/ordered-parallel-transform.ts
```

Running this example will output something similar to this:

```
Elapsed time: 1004.970725ms
Result: [
  1, 2, 3, 4,  5,
  6, 7, 8, 9, 10
]
```

The elapsed time is around 1 second because it processed 10 items concurrently
and the slowest took 1 second to be processed. Moreover the order of the items
in the result array is equal to the input one.

## License

Licensed under [MIT License](LICENSE.md).
