import { z } from "zod";

export const addressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]),
  recipientName: z.string().min(2, "Enter a name"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  line1: z.string().min(3, "Enter house/building"),
  area: z.string().min(2, "Enter area"),
  city: z.string().min(2, "Enter city"),
  state: z.string().min(2, "Enter state"),
  postalCode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  landmark: z.string().optional(),
  instructions: z.string().max(140).optional(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;
