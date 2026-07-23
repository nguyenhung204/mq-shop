import { z } from "zod";

export const shippingAddressSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  phone: z.string().min(8, "Phone is required."),
  line1: z.string().min(3, "Address line is required."),
  line2: z.string().optional(),
  city: z.string().min(2, "City is required."),
  district: z.string().optional(),
  postalCode: z.string().optional(),
  country: z
    .string()
    .length(2, "Country code must be 2 letters.")
    .regex(/^[A-Z]{2}$/, "Use uppercase ISO α-2."),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(["COD", "MOCK"]),
  note: z.string().max(500).optional(),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
