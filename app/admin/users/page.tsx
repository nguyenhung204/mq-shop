"use client";

import { FormEvent, useState } from "react";
import { useAdminUserAction, useCreateStaff } from "@/lib/queries/admin";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function UsersInner() {
  const [userId, setUserId] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("Password1");
  const userAction = useAdminUserAction();
  const createStaff = useCreateStaff();

  return (
    <>
      <PageHero title="Users & staff" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} />
      <Container className="py-10 max-w-lg space-y-6">
        <AdminNav />
        <div className="mq-card p-5 space-y-3">
          <h2 className="text-lg">User actions</h2>
          <input className="mq-input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={userAction.isPending} onClick={() => void userAction.mutateAsync({ action: "lock", userId })}>Lock</button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={userAction.isPending} onClick={() => void userAction.mutateAsync({ action: "unlock", userId })}>Unlock</button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" disabled={userAction.isPending} onClick={() => void userAction.mutateAsync({ action: "delete", userId })}>Soft delete</button>
          </div>
          <p className="text-xs text-mq-text-muted">Soft delete keeps data forever. Anonymization is Super Admin only.</p>
        </div>
        <form
          className="mq-card p-5 space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void createStaff.mutateAsync({
              email: staffEmail,
              password: staffPassword,
              permissions: [],
            });
          }}
        >
          <h2 className="text-lg">Create staff</h2>
          <input type="email" className="mq-input" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
          <input type="password" className="mq-input" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} required />
          <button className="mq-btn mq-btn-primary" disabled={createStaff.isPending}>
            {createStaff.isPending ? "Creating…" : "Create"}
          </button>
        </form>
      </Container>
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard roles={["ADMIN", "SUPER_ADMIN"]} permissions={["LOCK_USER", "CREATE_STAFF"]}>
      <UsersInner />
    </AuthGuard>
  );
}
