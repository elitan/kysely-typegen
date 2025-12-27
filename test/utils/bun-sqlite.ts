import { Database } from 'bun:sqlite';

export function createBunSqliteDatabase(db: Database) {
  return {
    close: () => db.close(),
    prepare: (query: string) => {
      const stmt = db.prepare(query);
      const isReader =
        query.trim().toLowerCase().startsWith('select') ||
        query.trim().toLowerCase().startsWith('pragma');
      return {
        reader: isReader,
        all: (params: unknown[]) => stmt.all(...params),
        run: (params: unknown[]) => {
          const result = stmt.run(...params);
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
          };
        },
        *iterate(params: unknown[]) {
          for (const row of stmt.iterate(...params)) {
            yield row;
          }
        },
      };
    },
  };
}
