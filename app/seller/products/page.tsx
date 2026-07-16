"use client";

import { FormEvent, useEffect, useState } from "react";
import { catalogApi, sellerApi } from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import type { ApiCategory, ApiProduct } from "@/lib/api/types";
import { asArray, formatMoney } from "@/lib/api/utils";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";

function ProductsInner() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    categoryId: "",
    sku: "",
    priceUsd: "19.99",
    nameVi: "",
    nameEn: "",
    imageUrl: "",
  });

  const load = async () => {
    try {
      const [p, c] = await Promise.all([sellerApi.products(), catalogApi.categories()]);
      setProducts(asArray(p));
      setCategories(asArray(c));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await sellerApi.createProduct({
        categoryId: form.categoryId,
        sku: form.sku,
        priceUsd: Number(form.priceUsd),
        translations: [
          { locale: "vi", name: form.nameVi },
          ...(form.nameEn ? [{ locale: "en", name: form.nameEn }] : []),
        ],
        images: form.imageUrl ? [{ url: form.imageUrl, sortOrder: 0 }] : [],
      });
      setForm({ ...form, sku: "", nameVi: "", nameEn: "", imageUrl: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  };

  return (
    <>
      <PageHero title="Products" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Products" }]} />
      <Container className="py-10 space-y-8">
        <SellerNav />
        {error && <div className="mq-alert mq-alert-error">{error}</div>}
        <form className="mq-card p-6 grid sm:grid-cols-2 gap-3" onSubmit={create}>
          <select className="mq-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
            <option value="">Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input className="mq-input" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input className="mq-input" type="number" step="0.01" min="0.01" placeholder="Price USD" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} required />
          <input className="mq-input" placeholder="Name (VI)" value={form.nameVi} onChange={(e) => setForm({ ...form, nameVi: e.target.value })} required />
          <input className="mq-input" placeholder="Name (EN)" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <input className="mq-input" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <button className="mq-btn mq-btn-primary sm:col-span-2">Create product (PENDING)</button>
        </form>
        <div className="mq-table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-mq-surface-subtle text-left">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Name</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-mq-border">
                  <td className="p-3">{p.sku}</td>
                  <td className="p-3">{p.name || p.translations?.[0]?.name || "—"}</td>
                  <td className="p-3">{formatMoney(p.priceUsd)}</td>
                  <td className="p-3"><span className="mq-badge mq-badge-cyan">{p.status}</span></td>
                  <td className="p-3">
                    <button type="button" className="text-xs underline" onClick={() => void sellerApi.hideProduct(p.id).then(load)}>Hide</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  );
}

export default function SellerProductsPage() {
  return (
    <AuthGuard roles={["SELLER"]}>
      <ProductsInner />
    </AuthGuard>
  );
}
