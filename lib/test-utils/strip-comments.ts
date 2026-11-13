/**
 * Strip // and block comments from TS/TSX source for text-based wiring tests,
 * leaving string/template literals untouched (so "https://" survives).
 */
export function stripComments(source: string): string {
  const re = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  return source.replace(re, (m, str) => (str ? str : ""));
}

/** True when the source has an obviously dead guard (`false &&`, `if (false)`, `true ||`). */
export function hasDeadBranchMarker(source: string): boolean {
  return /\bfalse\s*&&|\bif\s*\(\s*false\s*\)|\btrue\s*\|\|/.test(source);
}
