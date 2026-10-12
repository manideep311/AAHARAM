import { supabase } from "../lib/supabase";
import { Address } from "../types/domain";
import { addressFromRow, addressToWrite, type AddressRow } from "../supabase/functions/_shared/mappers";

export async function getAddresses(): Promise<Address[]> {
  const { data, error } = await supabase.from("addresses").select("*").order("created_at");
  if (error) throw error;
  return (data as AddressRow[]).map(addressFromRow);
}

export async function setDefaultAddress(id: string): Promise<void> {
  const { error } = await supabase.rpc("set_default_address", { address_id: id });
  if (error) throw error;
}

/** Creates the address when `addr.id` is empty, otherwise updates it. Returns its id. */
export async function saveAddress(addr: Address): Promise<string> {
  const fields = addressToWrite(addr);
  let id = addr.id;
  if (id) {
    const { error } = await supabase.from("addresses").update(fields).eq("id", id);
    if (error) throw error;
  } else {
    // Inserted as non-default first; set_default_address flips the default atomically, so the
    // one-default-per-user unique index is never violated.
    const { data, error } = await supabase.from("addresses").insert({ ...fields, is_default: false }).select("id").single();
    if (error) throw error;
    id = data.id as string;
  }
  if (addr.isDefault) await setDefaultAddress(id);
  return id;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) throw error;
}
