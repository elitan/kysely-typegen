export type ParsedCheckConstraint =
  | { type: 'string'; values: string[] }
  | { type: 'number'; values: number[] };

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
