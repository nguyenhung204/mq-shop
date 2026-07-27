import { redirect } from "next/navigation";

/** Legacy URL — system hub now lives under Admin shell with sidebar. */
export default function SuperAdminRedirectPage() {
  redirect("/admin/system");
}
