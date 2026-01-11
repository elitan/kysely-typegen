export type ParsedCheckConstraint =
  | { type: 'string'; values: string[] }
  | { type: 'number'; values: number[] }
  | { type: 'boolean' };

const ANY_ARRAY_REGEX = /= ANY \(\(?ARRAY\[(.*?)\]\)?(?:::[\w\[\]]+)?\)/;
const OR_CHAIN_REGEX = /\(\([^)]+= '([^']+)'(?:::[\w]+)?\)(?: OR \([^)]+= '([^']+)'(?:::[\w]+)?\))+\)/;

export function parseCheckConstraint(
  definition: string
): ParsedCheckConstraint | null {
  const anyArrayMatch = definition.match(ANY_ARRAY_REGEX);
  if (anyArrayMatch) {
    const arrayContent = anyArrayMatch[1];
    if (!arrayContent || arrayContent.trim() === '') return null;

    const numericValues = parseNumericArray(arrayContent);
    if (numericValues !== null) {
      return { type: 'number', values: numericValues };
    }

    const stringValues = parseStringArray(arrayContent);
    if (stringValues !== null && stringValues.length > 0) {
      return { type: 'string', values: stringValues };
    }
  }

  const orValues = parseOrChain(definition);
  if (orValues !== null && orValues.length > 0) {
    return { type: 'string', values: orValues };
  }

  return null;
}

function parseNumericArray(arrayContent: string): number[] | null {
  const isNumeric = /^\s*-?\d+(\s*,\s*-?\d+)*\s*$/.test(arrayContent);
  if (!isNumeric) return null;

  const values = arrayContent.split(',').map((v) => parseInt(v.trim(), 10));
  if (values.some((v) => isNaN(v))) return null;
  if (values.length === 0) return null;

  return values;
}

function parseStringArray(arrayContent: string): string[] | null {
  const values: string[] = [];
  let current = '';
  let inQuote = false;
  let i = 0;

  while (i < arrayContent.length) {
    const char = arrayContent[i];

    if (char === "'" && !inQuote) {
      inQuote = true;
      i++;
      continue;
    }

    if (char === "'" && inQuote) {
      if (arrayContent[i + 1] === "'") {
        current += "'";
        i += 2;
        continue;
      }
      values.push(current);
      current = '';
      inQuote = false;
      i++;
      continue;
    }

    if (inQuote) {
      current += char;
    }

    i++;
  }

  return values.length > 0 ? values : null;
}

function parseOrChain(definition: string): string[] | null {
  const singleValueRegex = /\([^)]+= '([^']+)'(?:::[\w]+)?\)/g;
  const values: string[] = [];
  let match;

  if (!definition.includes(' OR ')) {
    return null;
  }

  while ((match = singleValueRegex.exec(definition)) !== null) {
    let value = match[1];
    value = value.replace(/''/g, "'");
    values.push(value);
  }

  return values.length > 0 ? values : null;
}

const SQLITE_IN_REGEX = /\w+\s+IN\s*\(([^)]+)\)/i;

export function parseSqliteCheckConstraint(
  definition: string
): ParsedCheckConstraint | null {
  const match = definition.match(SQLITE_IN_REGEX);
  if (!match) return null;

  const valuesPart = match[1];
  if (!valuesPart || valuesPart.trim() === '') return null;

  const numericValues = parseNumericArray(valuesPart);
  if (numericValues !== null) {
    if (isBooleanPattern(numericValues)) {
      return { type: 'boolean' };
    }
    return { type: 'number', values: numericValues };
  }

  const stringValues = parseStringArray(valuesPart);
  if (stringValues !== null && stringValues.length > 0) {
    return { type: 'string', values: stringValues };
  }

  return null;
}

function isBooleanPattern(values: number[]): boolean {
  if (values.length !== 2) return false;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[0] === 0 && sorted[1] === 1;
}

const MSSQL_IN_REGEX = /\[\w+\]\s+IN\s*\(([^)]+)\)/i;
const MSSQL_OR_REGEX = /\[\w+\]='([^']+)'/g;

export function parseMssqlCheckConstraint(
  definition: string
): ParsedCheckConstraint | null {
  if (!definition || definition.trim() === '') return null;

  const inMatch = definition.match(MSSQL_IN_REGEX);
  if (inMatch) {
    const valuesPart = inMatch[1];
    if (!valuesPart || valuesPart.trim() === '') return null;

    const numericValues = parseNumericArray(valuesPart);
    if (numericValues !== null) {
      if (isBooleanPattern(numericValues)) {
        return { type: 'boolean' };
      }
      return { type: 'number', values: numericValues };
    }

    const stringValues = parseStringArray(valuesPart);
    if (stringValues !== null && stringValues.length > 0) {
      return { type: 'string', values: stringValues };
    }
  }

  if (definition.includes(' OR ')) {
    const values = parseMssqlOrChain(definition);
    if (values !== null && values.length > 0) {
      return { type: 'string', values };
    }
  }

  return null;
}

function parseMssqlOrChain(definition: string): string[] | null {
  const values: string[] = [];
  let match;

  const regex = /\[\w+\]='((?:[^']|'')*)'/g;
  while ((match = regex.exec(definition)) !== null) {
    let value = match[1];
    value = value.replace(/''/g, "'");
    values.push(value);
  }

  return values.length > 0 ? values : null;
}
