export function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function singularize(str: string): string {
  if (str.endsWith('s')) {
    return str.slice(0, -1);
  }
  return str;
}
