import micromatch from 'micromatch';
import type { TableMetadata } from '@/introspect/types';
import type { TransformOptions } from '@/transform/types';

export function filterTables(tables: TableMetadata[], options?: TransformOptions): TableMetadata[] {
  if (!options || (!options.includePattern && !options.excludePattern)) {
    return tables;
  }

  return tables.filter((table) => {
    const tablePattern = `${table.schema}.${table.name}`;

    if (options.excludePattern && options.excludePattern.length > 0) {
      if (micromatch.isMatch(tablePattern, options.excludePattern)) {
        return false;
      }
    }

    if (options.includePattern && options.includePattern.length > 0) {
      return micromatch.isMatch(tablePattern, options.includePattern);
    }

    return true;
  });
}
