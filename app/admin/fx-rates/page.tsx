import { redirect } from "next/navigation";

/** FX rates UI moved into fee config (`/admin/finance/configs`). */
export default function AdminFxRatesRedirectPage() {
  redirect("/admin/finance/configs");
}
