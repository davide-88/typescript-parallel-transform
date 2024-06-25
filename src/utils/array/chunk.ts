export const chunk = <T>(
  eventsDuration: T[],
  maxConcurrency: number,
): T[][] => {
  const chunks: T[][] = [];
  let i = 0;

  while (i < eventsDuration?.length) {
    chunks.push(eventsDuration.slice(i, (i += maxConcurrency)));
  }

  return chunks;
};
