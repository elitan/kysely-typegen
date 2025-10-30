import { CamelCasePlugin } from 'kysely';

/**
 * Case converter that uses Kysely's CamelCasePlugin
 */
class CaseConverter extends CamelCasePlugin {
  toCamelCase(str: string) {
    return this.camelCase(str);
  }
}

/**
 * Convert snake_case to camelCase using Kysely's conversion logic
 *
 * @example
 * toCamelCase('foo_bar') // => 'fooBar'
 * toCamelCase('created_at') // => 'createdAt'
 */
export function toCamelCase(str: string): string {
  return new CaseConverter().toCamelCase(str);
}
