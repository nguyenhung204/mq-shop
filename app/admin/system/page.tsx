"use client";

import Link from "next/link";
import { ClipboardList, HardDrive, ShieldAlert } from "lucide-react";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { useLanguage } from "@/components/providers/LanguageProvider";

function SystemHubInner() {
  const { t } = useLanguage();

  const links = [
    {
      href: "/admin/backups",
      icon: HardDrive,
      title: t("admin.backups.title"),
      desc: t("superAdmin.hub.backupsDesc"),
    },
    {
      href: "/admin/dsar",
      icon: ShieldAlert,
      title: t("admin.dsar.title"),
      desc: t("superAdmin.hub.dsarDesc"),
    },
    {
      href: "/admin/audit-logs",
      icon: ClipboardList,
      title: t("admin.audit.title"),
      desc: t("superAdmin.hub.auditDesc"),
    },
  ] as const;

  return (
    <>
      <AdminPageHeader
        title={t("superAdmin.title")}
        description={t("superAdmin.hub.intro")}
      />
      <div className="grid gap-3 max-w-2xl">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="mq-card p-5 flex items-start gap-3 hover:border-mq-accent-teal transition-colors"
            >
              <Icon
                size={22}
                strokeWidth={1.75}
                className="text-mq-accent-teal shrink-0 mt-0.5"
              />
              <span>
                <strong className="block text-mq-text">{item.title}</strong>
                <small className="text-mq-text-muted text-xs">{item.desc}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function AdminSystemPage() {
  return (
    <AuthGuard roles={["SUPER_ADMIN"]}>
      <SystemHubInner />
    </AuthGuard>
  );
}
