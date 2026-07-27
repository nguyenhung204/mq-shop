import { z } from "zod";
import { isValidE164 } from "@/lib/data/phone";

export const shippingAddressSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required."),
    /** E.164 string, dial code may differ from shipping country (tourists). */
    phone: z.string().min(8, "Phone is required.").max(32),
    line1: z.string().min(3, "Address line is required."),
    line2: z.string().optional(),
    city: z.string().min(2, "City is required."),
    district: z.string().optional(),
    postalCode: z.string().optional(),
    country: z
      .string()
      .length(2, "Country code must be 2 letters.")
      .regex(/^[A-Z]{2}$/, "Use uppercase ISO α-2."),
  })
  .superRefine((val, ctx) => {
    if (!isValidE164(val.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone with country dial code.",
      });
    }
  });

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(["COD", "MOCK"]),
  note: z.string().max(500).optional(),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
