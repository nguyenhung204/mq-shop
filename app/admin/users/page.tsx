"use client";

import { FormEvent, useState } from "react";
import { adminApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminNav } from "@/components/admin/AdminNav";
import { Container, PageHero } from "@/components/ui/shared";

function UsersInner() {
  const [userId, setUserId] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("Password1");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setError("");
    try {
      await fn();
      setMsg(success);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error");
    }
  };

  return (
    <>
      <PageHero title="Users & staff" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} />
      <Container className="py-10 max-w-lg space-y-6">
        <AdminNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        {msg && <div className="mq-alert mq-alert-success">{msg}</div>}
        <div className="mq-card p-5 space-y-3">
          <h2 className="text-lg">User actions</h2>
          <input className="mq-input" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void run(() => adminApi.lockUser(userId), "Locked")}>Lock</button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void run(() => adminApi.unlockUser(userId), "Unlocked")}>Unlock</button>
            <button type="button" className="mq-btn mq-btn-outline text-xs" onClick={() => void run(() => adminApi.deleteUser(userId), "Soft-deleted")}>Soft delete</button>
          </div>
          <p className="text-xs text-mq-text-muted">Soft delete keeps data forever. Anonymization is Super Admin only.</p>
        </div>
        <form
          className="mq-card p-5 space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void run(
              () =>
                adminApi.createStaff({
                  email: staffEmail,
                  password: staffPassword,
                  permissions: [],
                }),
              "Staff created (may need Super Admin approve)",
            );
          }}
        >
          <h2 className="text-lg">Create staff</h2>
          <input type="email" className="mq-input" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
          <input type="password" className="mq-input" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} required />
          <button className="mq-btn mq-btn-primary">Create</button>
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
