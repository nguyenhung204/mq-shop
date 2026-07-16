import { z } from "zod";

export const checkoutSchema = z.object({
  shippingAddress: z
    .string()
    .min(5, "Shipping address must be at least 5 characters.")
    .max(500, "Shipping address must be at most 500 characters."),
  shippingCountry: z
    .string()
    .length(2, "Country code must be 2 letters (ISO α-2).")
    .regex(/^[A-Z]{2}$/, "Country code must be uppercase ISO α-2."),
  paymentMethod: z.enum(["COD", "BANK_TRANSFER", "CARD"]),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
