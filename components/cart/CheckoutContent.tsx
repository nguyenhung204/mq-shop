"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { splitStoredPhone, toE164 } from "@/lib/data/phone";
import { ApiError } from "@/lib/api/client";
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/lib/validations/checkout";
import { useCartStore } from "@/lib/stores/cart-store";
import { useCheckout, useShippingQuote } from "@/lib/queries/orders";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { AddressRegionFields } from "@/components/ui/AddressRegionFields";
import { Container, PageHero } from "@/components/ui/shared";

export function CheckoutContent() {
  const { t } = useLanguage();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { items, itemCount, subtotal, clearCart, checkoutItems } = useCart();
  const [cartReady, setCartReady] = useState(() =>
    typeof window === "undefined" ? false : useCartStore.persist.hasHydrated(),
  );
  const [placed, setPlaced] = useState<{ id: string; code: string; total: number } | null>(
    null,
  );
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [profileSeeded, setProfileSeeded] = useState(false);
  const [nationalPhone, setNationalPhone] = useState("");
  const [dialCountry, setDialCountry] = useState("VN");
  const [dialTouched, setDialTouched] = useState(false);
  const quote = useShippingQuote();
  const checkout = useCheckout();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingAddress: {
        fullName: "",
        phone: "",
        line1: "",
        line2: "",
        city: "",
        district: "",
        postalCode: "",
        country: "VN",
      },
      paymentMethod: "MOCK",
      note: "",
    },
  });

  useEffect(() => {
    setCartReady(useCartStore.persist.hasHydrated());
    return useCartStore.persist.onFinishHydration(() => setCartReady(true));
  }, []);

  // Prefill contact fields from the signed-in profile once.
  useEffect(() => {
    if (!user || profileSeeded) return;
    const shipCountry = "VN";
    const national = splitStoredPhone(user.phone, shipCountry);
    setDialCountry(shipCountry);
    setNationalPhone(national);
    reset({
      shippingAddress: {
        fullName: user.fullName?.trim() || "",
        phone: national ? toE164(shipCountry, national) : "",
        line1: "",
        line2: "",
        city: "",
        district: "",
        postalCode: "",
        country: shipCountry,
      },
      paymentMethod: "MOCK",
      note: "",
    });
    setProfileSeeded(true);
  }, [user, profileSeeded, reset]);

  const address = watch("shippingAddress");
  const lineItems = useMemo(() => checkoutItems(), [items]);

  const syncPhone = (nextDialCountry: string, nextNational: string) => {
    setNationalPhone(nextNational);
    setValue(
      "shippingAddress.phone",
      nextNational ? toE164(nextDialCountry, nextNational) : "",
      { shouldValidate: true, shouldDirty: true },
    );
  };

  useEffect(() => {
    if (!isAuthenticated || lineItems.length === 0) return;
    if (!address?.fullName || !address.phone || !address.line1 || !address.city) {
      setShippingFee(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void quote
        .mutateAsync({
          items: lineItems,
          shippingAddress: {
            ...address,
            country: address.country || "VN",
          },
        })
        .then((q) => setShippingFee(q.shippingFee))
        .catch(() => setShippingFee(null));
    }, 400);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on address/items only
  }, [
    isAuthenticated,
    lineItems,
    address?.fullName,
    address?.phone,
    address?.line1,
    address?.city,
    address?.district,
    address?.country,
  ]);

  if (authLoading || !cartReady) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16">
          <div className="h-40 rounded-[var(--mq-radius-lg)] bg-mq-surface-subtle animate-pulse" />
        </Container>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">{t("checkout.signInRequired")}</p>
          <Link href="/my-account" className="mq-btn mq-btn-primary">
            {t("account.logIn")}
          </Link>
        </Container>
      </>
    );
  }

  if (itemCount === 0 && !placed) {
    return (
      <>
        <PageHero title={t("checkout.title")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center">
          <p className="text-mq-text-secondary mb-6">{t("checkout.empty")}</p>
          <Link href="/shop" className="mq-btn mq-btn-primary">
            {t("checkout.goToShop")}
          </Link>
        </Container>
      </>
    );
  }

  if (placed) {
    return (
      <>
        <PageHero title={t("checkout.orderPlaced")} breadcrumb={[{ label: t("checkout.title") }]} />
        <Container className="py-16 text-center max-w-lg mx-auto">
          <h2 className="text-2xl text-mq-text mb-3">{t("checkout.thankYou")}</h2>
          <p className="text-mq-text-secondary mb-2">
            {t("checkout.orderLabel")} <strong>{placed.code}</strong> · {formatPrice(placed.total)}{" "}
            USD
          </p>
          <p className="text-sm text-mq-text-muted mb-8">{t("checkout.paymentStubNote")}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href={`/orders/${placed.id}`} className="mq-btn mq-btn-primary">
              {t("checkout.viewOrder")}
            </Link>
            <Link href="/shop" className="mq-btn mq-btn-outline">
              {t("cart.continueShopping")}
            </Link>
          </div>
        </Container>
      </>
    );
  }

  const previewTotal = subtotal + (shippingFee ?? 0);

  const onSubmit = async (values: CheckoutFormValues) => {
    try {
      const phone = toE164(
        dialCountry,
        nationalPhone || values.shippingAddress.phone,
      );
      const order = await checkout.mutateAsync({
        items: checkoutItems(),
        shippingAddress: {
          ...values.shippingAddress,
          phone,
          country: values.shippingAddress.country || "VN",
        },
        paymentMethod: values.paymentMethod,
        note: values.note || undefined,
      });
      clearCart();
      setPlaced({ id: order.id, code: order.code, total: order.total });
      toast.success(t("checkout.orderPlaced"), {
        description: order.code,
      });
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error(t("checkout.failed"));
      }
    }
  };

  return (
    <>
      <PageHero
        title={t("checkout.title")}
        breadcrumb={[
          { label: t("nav.cart"), href: "/cart" },
          { label: t("checkout.title") },
        ]}
      />
      <Container className="py-10 md:py-16">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10"
        >
          <div className="space-y-6 min-w-0">
            <section className="border border-mq-border bg-mq-surface p-6 rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <h2 className="text-lg font-semibold text-mq-text mb-1">
                {t("checkout.customerDetails")}
              </h2>
              <p className="text-sm text-mq-text-muted mb-5">{t("checkout.customerDetailsHint")}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="email">
                    {t("checkout.email")}
                  </label>
                  <input
                    id="email"
                    className="mq-input"
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    disabled
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="fullName">
                    {t("checkout.fullName")}
                  </label>
                  <input
                    id="fullName"
                    className="mq-input"
                    autoComplete="name"
                    placeholder={t("checkout.fullNamePlaceholder")}
                    {...register("shippingAddress.fullName")}
                  />
                  {errors.shippingAddress?.fullName && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.fullName.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="border border-mq-border bg-mq-surface p-6 rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <h2 className="text-lg font-semibold text-mq-text mb-1">
                {t("checkout.shippingDetails")}
              </h2>
              <p className="text-sm text-mq-text-muted mb-5">{t("checkout.shippingDetailsHint")}</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="country">
                    {t("checkout.country")}
                  </label>
                  <CountrySelect
                    id="country"
                    {...register("shippingAddress.country", {
                      onChange: (e) => {
                        const next = String(e.target.value || "VN").toUpperCase();
                        // Soft-default dial to shipping country until user picks a dial manually.
                        if (!dialTouched) {
                          setDialCountry(next);
                          syncPhone(next, nationalPhone);
                        }
                        setValue("shippingAddress.city", "");
                        setValue("shippingAddress.district", "");
                      },
                    })}
                  />
                  {errors.shippingAddress?.country && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.country.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm mb-1.5" htmlFor="phone">
                    {t("checkout.phone")}
                  </label>
                  <PhoneInput
                    id="phone"
                    dialCountry={dialCountry}
                    onDialCountryChange={(code) => {
                      setDialTouched(true);
                      setDialCountry(code);
                      syncPhone(code, nationalPhone);
                    }}
                    value={nationalPhone}
                    onChange={(national) => syncPhone(dialCountry, national)}
                    aria-invalid={Boolean(errors.shippingAddress?.phone)}
                  />
                  <p className="text-xs text-mq-text-muted mt-1.5">
                    {t("checkout.phoneHint")}
                  </p>
                  {errors.shippingAddress?.phone && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.phone.message}
                    </p>
                  )}
                </div>

                <AddressRegionFields
                  countryCode={address?.country || "VN"}
                  city={address?.city || ""}
                  district={address?.district || ""}
                  onCityChange={(next) =>
                    setValue("shippingAddress.city", next, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  onDistrictChange={(next) =>
                    setValue("shippingAddress.district", next, {
                      shouldDirty: true,
                    })
                  }
                  cityError={errors.shippingAddress?.city?.message}
                />

                <div>
                  <label className="block text-sm mb-1.5" htmlFor="postalCode">
                    {t("checkout.postalCode")}
                  </label>
                  <input
                    id="postalCode"
                    className="mq-input"
                    autoComplete="postal-code"
                    {...register("shippingAddress.postalCode")}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="line1">
                    {t("checkout.address")}
                  </label>
                  <input
                    id="line1"
                    className="mq-input"
                    autoComplete="street-address"
                    placeholder={t("checkout.addressPlaceholder")}
                    {...register("shippingAddress.line1")}
                  />
                  {errors.shippingAddress?.line1 && (
                    <p className="text-xs text-mq-accent-orange mt-1.5">
                      {errors.shippingAddress.line1.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="border border-mq-border bg-mq-surface p-6 rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)]">
              <h2 className="text-lg font-semibold text-mq-text mb-5">
                {t("checkout.paymentMethod")}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="paymentMethod">
                    {t("checkout.paymentMethod")}
                  </label>
                  <select
                    id="paymentMethod"
                    className="mq-input"
                    {...register("paymentMethod")}
                  >
                    <option value="MOCK">{t("checkout.paymentMock")}</option>
                    <option value="COD">{t("checkout.paymentCod")}</option>
                  </select>
                  <p className="text-xs text-mq-text-muted mt-2">{t("checkout.paymentHint")}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm mb-1.5" htmlFor="note">
                    {t("checkout.note")}
                  </label>
                  <textarea
                    id="note"
                    className="mq-textarea"
                    rows={3}
                    placeholder={t("checkout.notePlaceholder")}
                    {...register("note")}
                  />
                </div>
              </div>
            </section>
          </div>

          <aside className="border border-mq-border p-6 h-fit bg-mq-surface-subtle rounded-[var(--mq-radius-lg)] shadow-[var(--mq-shadow-sm)] lg:sticky lg:top-24">
            <h2 className="text-lg mb-4">{t("checkout.yourOrder")}</h2>
            <ul className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3 text-sm">
                  <div className="relative w-12 h-12 shrink-0 mq-product-image-bg mq-product-media">
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      className="mq-product-media-img"
                      sizes="48px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1">{item.name}</p>
                    <p className="text-mq-text-muted text-xs">
                      {item.sku} × {item.quantity}
                    </p>
                  </div>
                  <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 text-sm border-t border-mq-border pt-4">
              <div className="flex justify-between">
                <span>{t("cart.subtotal")}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("cart.shipping")}</span>
                <span>
                  {shippingFee == null
                    ? quote.isPending
                      ? "…"
                      : t("checkout.shippingPending")
                    : formatPrice(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between font-medium text-base pt-2">
                <span>{t("cart.total")}</span>
                <span>{formatPrice(previewTotal)}</span>
              </div>
            </div>
            <button
              type="submit"
              className="mq-btn mq-btn-primary w-full mt-6"
              disabled={isSubmitting || checkout.isPending}
            >
              {isSubmitting || checkout.isPending
                ? t("checkout.placing")
                : t("checkout.placeOrder")}
            </button>
          </aside>
        </form>
      </Container>
    </>
  );
}
