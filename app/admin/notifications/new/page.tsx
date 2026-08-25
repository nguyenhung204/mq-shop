import { redirect } from "next/navigation";

export default function AdminNotificationComposeRedirect() {
  redirect("/admin/notifications?tab=compose");
}
