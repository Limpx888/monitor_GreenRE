/** Join class names, skipping falsy values: cn('a', cond && 'b') */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
