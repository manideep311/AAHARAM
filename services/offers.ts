import { supabase } from "../lib/supabase";
import { Offer } from "../types/domain";
import { offerFromRow } from "../supabase/functions/_shared/mappers";

export async function getOffers(): Promise<Offer[]> {
  const { data, error } = await supabase.from("offers").select("*").order("id");
  if (error) throw error;
  return data.map(offerFromRow);
}
