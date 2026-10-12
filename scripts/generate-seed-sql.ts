// Generates supabase/seed.sql from the TypeScript seed files, which stay the single source
// of truth for the catalog. Run after editing data/seed/*.ts:
//   npx tsx scripts/generate-seed-sql.ts
import { writeFileSync } from "fs";
import { join } from "path";
import { SEED_RESTAURANTS } from "../data/seed/restaurants";
import { SEED_CATEGORIES } from "../data/seed/categories";
import { SEED_MENU_ITEMS } from "../data/seed/menu-items";
import { SEED_OFFERS, SEED_COUPONS } from "../data/seed/offers";
import {
  couponToRow, menuCategoryToRow, menuItemToRow, offerToRow, restaurantToRow,
} from "../supabase/functions/_shared/mappers";

export const SEED_SQL_PATH = join(__dirname, "..", "supabase", "seed.sql");

const TEXT_ARRAY_COLUMNS = new Set(["cuisines", "offer_ids", "tags"]);
const JSONB_COLUMNS = new Set(["option_groups", "add_ons"]);

export function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export function sqlValue(column: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (TEXT_ARRAY_COLUMNS.has(column)) {
    const items = value as string[];
    return items.length ? `array[${items.map(quote).join(", ")}]::text[]` : "'{}'::text[]";
  }
  if (JSONB_COLUMNS.has(column)) return `${quote(JSON.stringify(value))}::jsonb`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return quote(value);
  throw new Error(`Unsupported value for column "${column}": ${JSON.stringify(value)}`);
}

function upsert<T extends object>(table: string, key: keyof T & string, rows: T[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => `  (${columns.map((c) => sqlValue(c, (row as Record<string, unknown>)[c])).join(", ")})`)
    .join(",\n");
  const updates = columns
    .filter((c) => c !== key)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return `insert into public.${table} (${columns.join(", ")}) values\n${values}\non conflict (${key}) do update set ${updates};\n`;
}

export function buildSeedSql(): string {
  return [
    "-- GENERATED FILE - do not edit by hand.",
    "-- Source: data/seed/*.ts. Regenerate with: npx tsx scripts/generate-seed-sql.ts",
    "",
    upsert("restaurants", "id", SEED_RESTAURANTS.map(restaurantToRow)),
    upsert("menu_categories", "id", SEED_CATEGORIES.map(menuCategoryToRow)),
    upsert("menu_items", "id", SEED_MENU_ITEMS.map(menuItemToRow)),
    upsert("offers", "id", SEED_OFFERS.map(offerToRow)),
    upsert("coupons", "code", SEED_COUPONS.map(couponToRow)),
  ].join("\n");
}

if (require.main === module) {
  writeFileSync(SEED_SQL_PATH, buildSeedSql());
  console.log(`Wrote ${SEED_SQL_PATH}`);
}
