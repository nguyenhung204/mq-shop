"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatPrice } from "@/lib/data/products";
import { splitStoredPhone, toE164 } from "@/lib/data/phone";
import { getErrorMessage } from "@/lib/queries/utils";
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/lib/validations/checkout";
import { useCartStore } from "@/lib/stores/cart-store";
import { useCheckout, useShippingQuote } from "@/lib/queries/orders";
import { useShopPaymentProfile } from "@/lib/queries/seller";
import { useCart } from "@/components/providers/CartProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useRegion } from "@/components/providers/RegionProvider";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { AddressRegionFields } from "@/components/ui/AddressRegionFields";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Container, PageHero } from "@/components/ui/shared";
import { FormAlerts } from "@/lib/ui/form-feedback";
import {
  CrossBorderWarningModal,
  detectCrossBorderItems,
} from "@/components/cart/CrossBorderWarningModal";
import type { GateRegionId } from "@/lib/i18n/regions";

export function CheckoutContent() {
  const { t, locale } = useLanguage();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { regionCode, setRegion } = useRegion();
  const {
    items,
    selectedItems,
    itemCount,
    selectedItemCount,
    subtotal,
    selectedSubtotal,
    clearCart,
    checkoutSelectedItems,
    updateQuantity,
    selectedShopIds,
  } = useCart();
  const [cartReady, setCartReady] = useState(() =>
    typeof window === "undefined" ? false : useCartStore.persist.hasHydrated(),
  );
  const [placed, setPlaced] = useState<{ id: string; code: string; displayName: string; total: number } | null>(
    null,
  );
  const [shippingFee, setShippingFee] = useState<number | null>(null);
  const [profileSeeded, setProfileSeeded] = useState(false);
  const [nationalPhone, setNationalPhone] = useState("");
  const [dialCountry, setDialCountry] = useState("VN");
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [dialTouched, setDialTouched] = useState(false);
  const [crossBorderOpen, setCrossBorderOpen] = useState(false);
  const [crossBorderBypassed, setCrossBorderBypassed] = useState(false);
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
      paymentMethod: "OFF_PLATFORM",
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
      paymentMethod: "OFF_PLATFORM",
      note: "",
    });
    setProfileSeeded(true);
  }, [user, profileSeeded, reset]);

  const address = watch("shippingAddress");
  const lineItems = useMemo(() => checkoutSelectedItems(), [selectedItems]);
  const checkoutShopId = selectedShopIds[0] ?? selectedItems[0]?.shopId ?? null;
  const { data: paymentProfile } = useShopPaymentProfile(checkoutShopId);

  // Detect cross-border items: compare shipping address country vs product countryCodes
  const shippingCountry = address?.country?.toUpperCase() || null;
  const crossBorderCheck = useMemo(
    () => detectCrossBorderItems(selectedItems, shippingCountry),
    [selectedItems, shippingCountry],
  );

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
            {t("checkout.orderLabel")} <strong>{placed.displayName}</strong> · {formatPrice(placed.total)}{" "}
            USD
          </p>
          <p className="text-sm text-mq-text-muted mb-8">{t("checkout.paySellerDirectly")}</p>
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

  const previewTotal = selectedSubtotal + (shippingFee ?? 0);

  const onSubmit = async (values: CheckoutFormValues) => {
    // Check for cross-border items before placing order
    if (
      crossBorderCheck.crossBorderItems.length > 0 &&
      !crossBorderBypassed
    ) {
      setCrossBorderOpen(true);
      return;
    }

    setSubmitError(null);
    try {
      const phone = toE164(
        dialCountry,
        nationalPhone || values.shippingAddress.phone,
      );
      const order = await checkout.mutateAsync({
        items: checkoutSelectedItems(),
        shippingAddress: {
          ...values.shippingAddress,
          phone,
          country: values.shippingAddress.country || "VN",
        },
        paymentMethod: values.paymentMethod,
        note: values.note || undefined,
      });
      clearCart();
      setPlaced({ id: order.id, code: order.code, displayName: order.displayName, total: order.total });
      toast.success(t("checkout.orderPlaced"), {
        description: order.displayName,
      });
    } catch (err) {
      setSubmitError(err);
    }
  };

  const handleCrossBorderContinue = () => {
    setCrossBorderBypassed(true);
    setCrossBorderOpen(false);
    // Re-trigger form submit
    handleSubmit(onSubmit)();
  };

  const handleCrossBorderSwitchRegion = (regionId: GateRegionId) => {
    // Map region id to country code for shipping address
    const countryMap: Record<GateRegionId, string> = {
      tw: "TW",
      my: "MY",
      vn: "VN",
      sg: "SG",
      us: "US",
    };
    const newCountry = countryMap[regionId] || "VN";
    setValue("shippingAddress.country", newCountry, { shouldValidate: true });
    setRegion(regionId);
    setCrossBorderOpen(false);
    setCrossBorderBypassed(false);
    toast.info(t("crossBorder.regionSwitched"));
  };

  const submitErrorText = submitError
    ? getErrorMessage(submitError, t("checkout.failed"), locale)
    : "";

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
            <FormAlerts error={submitErrorText} />
            {selectedShopIds.length > 1 && (
              <div className="mq-alert mq-alert-warn flex items-start gap-3">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm">{t("cart.multiShopWarning")}</p>
                  <a href="/cart" className="text-xs font-medium underline mt-1 inline-block opacity-80 hover:opacity-100">
                    {t("nav.cart")} →
                  </a>
                </div>
              </div>
            )}
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
              <h2 className="text-lg font-semibold text-mq-text mb-2">
                {t("checkout.paymentMethod")}
              </h2>
              <p className="text-sm text-mq-text-muted mb-5">{t("checkout.paySellerDirectly")}</p>
              <input type="hidden" {...register("paymentMethod")} />
              <div className="space-y-4">
                {paymentProfile ? (
                  <div className="rounded-[var(--mq-radius-sm)] border border-mq-border bg-mq-surface-subtle p-4 text-sm space-y-2">
                    <p className="font-medium text-mq-text">
                      {paymentProfile.shopName || t("checkout.sellerPaymentProfile")}
                    </p>
                    {paymentProfile.bankName || paymentProfile.accountNumber ? (
                      <dl className="grid gap-1.5 text-mq-text-secondary">
                        {paymentProfile.bankName ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.bankName")}:</dt>
                            <dd>{paymentProfile.bankName}</dd>
                          </div>
                        ) : null}
                        {paymentProfile.accountNumber ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.accountNumber")}:</dt>
                            <dd className="font-mono">{paymentProfile.accountNumber}</dd>
                          </div>
                        ) : null}
                        {paymentProfile.accountName ? (
                          <div className="flex flex-wrap gap-x-2">
                            <dt className="text-mq-text-muted">{t("checkout.accountName")}:</dt>
                            <dd>{paymentProfile.accountName}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : (
                      <p className="text-mq-accent-orange text-xs">
                        {t("checkout.bankInfoUnavailable")}
                      </p>
                    )}
                    {paymentProfile.qrUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={paymentProfile.qrUrl}
                        alt={t("checkout.paymentQr")}
                        className="mt-2 max-h-40 w-auto rounded border border-mq-border bg-white object-contain"
                      />
                    ) : null}
                  </div>
                ) : checkoutShopId ? (
                  <p className="text-xs text-mq-text-muted">{t("checkout.loadingPaymentProfile")}</p>
                ) : null}
                <div>
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
            <ul className="space-y-4 mb-4 max-h-72 overflow-y-auto">
              {selectedItems.map((item) => (
                <li key={item.variantId} className="flex gap-3 text-sm">
                  <Link
                    href={`/product/${item.productId}`}
                    className="relative w-12 h-12 shrink-0 mq-product-image-bg mq-product-media"
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      className="mq-product-media-img"
                      sizes="48px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex gap-2 justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/product/${item.productId}`}
                          className="line-clamp-1 font-medium hover:text-mq-gold transition-colors"
                        >
                          {item.name}
                        </Link>
                        <p className="text-mq-text-muted text-xs">{item.sku}</p>
                      </div>
                      <span className="shrink-0 tabular-nums">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      min={1}
                      onChange={(next) => updateQuantity(item.variantId, next)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-2 text-sm border-t border-mq-border pt-4">
              <div className="flex justify-between">
                <span>{t("cart.subtotal")}</span>
                <span>{formatPrice(selectedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-mq-text-muted text-xs">
                <span>{t("cart.quantity")}</span>
                <span className="tabular-nums">
                  {selectedItemCount} {selectedItemCount === 1 ? t("cart.item") : t("cart.items")}
                </span>
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

      <CrossBorderWarningModal
        open={crossBorderOpen}
        onClose={() => setCrossBorderOpen(false)}
        onContinue={handleCrossBorderContinue}
        onSwitchRegion={handleCrossBorderSwitchRegion}
        crossBorderItems={crossBorderCheck.crossBorderItems}
        alternativeRegions={crossBorderCheck.alternativeRegions}
      />
    </>
  );
}
