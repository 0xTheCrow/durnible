// https://github.com/cloudrac3r/cadencegq/blob/master/pug/mxid.pug
//
// djb2-style hash for distributing user IDs across the 8 fixed username
// colors defined as CSS custom properties (--mx-uc-1 through --mx-uc-8).
// Bitwise math here is intentional — `<< 5` and `| 0` give us a fast 32-bit
// integer hash without bringing in a real hashing library for what's
// effectively a stable color picker.
function hashCode(str: string): number {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i += 1) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // coerce back to 32-bit signed int
  }
  return Math.abs(hash);
}

export function cssColorMXID(userId: string): string {
  const colorNumber = hashCode(userId) % 8;
  return `--mx-uc-${colorNumber + 1}`;
}

export default function colorMXID(userId: string): string {
  return `var(${cssColorMXID(userId)})`;
}
