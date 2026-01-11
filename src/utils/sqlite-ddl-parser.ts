export type SqliteCheckConstraint = {
  columnName: string;
  definition: string;
};

export function parseSqliteTableDDL(sql: string): SqliteCheckConstraint[] {
  const constraints: SqliteCheckConstraint[] = [];

  const checkRegex = /CHECK\s*\(\s*(\w+)\s+IN\s*\(([^)]+)\)\s*\)/gi;

  let match;
  while ((match = checkRegex.exec(sql)) !== null) {
    const columnName = match[1];
    const valuesPart = match[2];
    constraints.push({
      columnName,
      definition: `${columnName} IN (${valuesPart})`,
    });
  }

  return constraints;
}
