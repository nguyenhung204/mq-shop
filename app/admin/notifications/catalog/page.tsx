import { redirect } from "next/navigation";

export default function AdminNotificationCatalogRedirect() {
  redirect("/admin/notifications?tab=catalog");
}
