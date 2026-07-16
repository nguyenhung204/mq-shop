"use client";

import { FormEvent, useState } from "react";
import { formatMoney } from "@/lib/api/utils";
import {
  useCategories,
  useCreateSellerProduct,
  useHideSellerProduct,
  useSellerProducts,
} from "@/lib/queries/seller";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { SellerNav } from "@/components/seller/SellerNav";
import { Container, PageHero } from "@/components/ui/shared";
import { TableSkeleton } from "@/components/ui/Skeleton";

function ProductsInner() {
  const { data: products = [], isLoading: productsLoading, isError, error } = useSellerProducts();
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateSellerProduct();
  const hideProduct = useHideSellerProduct();
  const [form, setForm] = useState({
    categoryId: "",
    sku: "",
    priceUsd: "19.99",
    nameVi: "",
    nameEn: "",
    imageUrl: "",
  });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await createProduct.mutateAsync({
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
  };

  return (
    <>
      <PageHero title="Products" breadcrumb={[{ label: "Seller", href: "/seller" }, { label: "Products" }]} />
      <Container className="py-10 space-y-8">
        <SellerNav />
        {isError && (
          <div className="mq-alert mq-alert-error">
            {error instanceof Error ? error.message : "Failed to load"}
          </div>
        )}
        <form className="mq-card p-6 grid sm:grid-cols-2 gap-3" onSubmit={(e) => void create(e)}>
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
          <button className="mq-btn mq-btn-primary sm:col-span-2" disabled={createProduct.isPending}>
            {createProduct.isPending ? "Creating…" : "Create product (PENDING)"}
          </button>
        </form>
        {productsLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
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
                      <button type="button" className="text-xs underline" disabled={hideProduct.isPending} onClick={() => void hideProduct.mutateAsync(p.id)}>Hide</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
