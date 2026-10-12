import { readFileSync } from "fs";
import { buildSeedSql, quote, sqlValue, SEED_SQL_PATH } from "../scripts/generate-seed-sql";

describe("seed SQL generator", () => {
  it("escapes single quotes", () => {
    expect(quote("Domino's")).toBe("'Domino''s'");
  });

  it("types empty arrays by column", () => {
    expect(sqlValue("cuisines", [])).toBe("'{}'::text[]");
    expect(sqlValue("option_groups", [])).toBe("'[]'::jsonb");
  });

  it("renders text arrays, json, scalars and nulls", () => {
    expect(sqlValue("tags", ["Top Rated", "Kid's Pick"])).toBe("array['Top Rated', 'Kid''s Pick']::text[]");
    expect(sqlValue("add_ons", [{ id: "a1" }])).toBe(`'[{"id":"a1"}]'::jsonb`);
    expect(sqlValue("base_price", 220)).toBe("220");
    expect(sqlValue("is_open", false)).toBe("false");
    expect(sqlValue("phone", null)).toBe("null");
  });

  it("upserts every catalog table", () => {
    const sql = buildSeedSql();
    for (const table of ["restaurants", "menu_categories", "menu_items", "offers", "coupons"]) {
      expect(sql).toContain(`insert into public.${table} (`);
    }
    expect(sql).toContain("on conflict (code) do update set");
  });

  it("supabase/seed.sql is up to date with data/seed (run: npx tsx scripts/generate-seed-sql.ts)", () => {
    const onDisk = readFileSync(SEED_SQL_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(onDisk).toBe(buildSeedSql());
  });
});
