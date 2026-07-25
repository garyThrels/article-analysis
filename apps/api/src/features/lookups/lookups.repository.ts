import { asc } from "drizzle-orm";
import type { Lookups } from "@carma/shared";
import { db } from "../../db/index.js";
import { languages, sources } from "../../db/schema.js";

/** Reference data for the filter controls: all sources and languages. */
export async function getLookups(): Promise<Lookups> {
  const [sourceRows, languageRows] = await Promise.all([
    db.select({ id: sources.id, name: sources.name }).from(sources).orderBy(asc(sources.name)),
    db
      .select({ id: languages.id, code: languages.code, name: languages.name })
      .from(languages)
      .orderBy(asc(languages.name)),
  ]);
  return { sources: sourceRows, languages: languageRows };
}
