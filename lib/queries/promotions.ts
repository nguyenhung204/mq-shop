"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminPromotionApi,
  bannerApi,
  marketingApi,
  promotionApi,
  type BannerLang,
  type CreateMarketingFolderBody,
  type CreatePromotionBody,
  type ListBannersParams,
  type ListPromotionsParams,
  type MarketingFolder,
  type Promotion,
  type UpdateMarketingFolderBody,
  type UpdatePromotionBody,
} from "@/lib/api/promotions";
import { ApiError } from "@/lib/api/client";
import { asArray, parsePage } from "@/lib/api/utils";
import { getErrorMessage } from "@/lib/queries/utils";

export const promotionKeys = {
  all: ["promotions"] as const,
  sellerList: (params: ListPromotionsParams) =>
    [...promotionKeys.all, "seller", params.status ?? "", params.page ?? 1, params.pageSize ?? 20] as const,
  sellerDetail: (id: string) => [...promotionKeys.all, "seller", "detail", id] as const,
  adminList: (params: ListPromotionsParams) =>
    [...promotionKeys.all, "admin", params.status ?? "", params.page ?? 1, params.pageSize ?? 20] as const,
  adminDetail: (id: string) => [...promotionKeys.all, "admin", "detail", id] as const,
};

export const bannerKeys = {
  all: ["banners"] as const,
  public: (lang: BannerLang) => [...bannerKeys.all, "public", lang] as const,
  admin: (params: ListBannersParams) =>
    [...bannerKeys.all, "admin", params.lang ?? "", params.page ?? 1, params.pageSize ?? 20] as const,
};

export const marketingKeys = {
  all: ["marketing"] as const,
  folders: (page = 1, pageSize = 20) =>
    [...marketingKeys.all, "folders", page, pageSize] as const,
  folder: (id: string) => [...marketingKeys.all, "folder", id] as const,
  adminFolders: (page = 1, pageSize = 20) =>
    [...marketingKeys.all, "admin-folders", page, pageSize] as const,
  adminFolder: (id: string) => [...marketingKeys.all, "admin-folder", id] as const,
};

function promoErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "PROMO_INVALID_SKU":
        return "One or more SKUs are invalid for this shop.";
      case "PROMO_INVALID_SCOPE":
        return "Invalid scope: TARGETED needs SKUs or categories; PLATFORM cannot include them.";
      case "PROMO_INVALID_WINDOW":
        return "End date must be after start date.";
      case "PROMO_CODE_REQUIRED":
        return "Voucher code is required.";
      case "PROMO_CODE_TAKEN":
        return "This voucher code is already in use.";
      case "PROMO_DISCOUNT_REQUIRED":
        return "Discount value is required for this promotion type.";
      case "PROMO_NOT_FOUND":
        return "Promotion not found.";
      case "PROMO_NOT_PENDING":
        return "Only PENDING promotions can be updated or reviewed.";
      case "SHOP_NOT_APPROVED":
        return "Shop must be APPROVED and not suspended.";
      case "CATEGORY_NOT_FOUND":
        return "One or more categories were not found.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

function bannerErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "BANNER_NOT_FOUND":
        return "Banner not found.";
      case "INVALID_BANNER_IMAGE":
        return "Invalid image. Use JPEG, PNG, WebP, or GIF.";
      case "BANNER_IMAGE_TOO_LARGE":
        return "Banner image must be ≤ 5MB.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

function mediaErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "MEDIA_FOLDER_NOT_FOUND":
        return "Folder not found.";
      case "MEDIA_ASSET_NOT_FOUND":
        return "Asset not found.";
      case "MEDIA_FOLDER_EMPTY":
        return "Folder is empty — nothing to download.";
      case "INVALID_MEDIA_ASSET":
        return "Invalid file. Check type and try again.";
      case "MEDIA_ASSET_TOO_LARGE":
        return "File must be ≤ 20MB.";
      case "FORBIDDEN":
        return "You do not have permission to access marketing materials.";
      default:
        break;
    }
  }
  return getErrorMessage(e, fallback);
}

/* ─── Seller promotions ─────────────────────────────────────────────── */

export function useSellerPromotions(params: ListPromotionsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: promotionKeys.sellerList({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<Promotion>(await promotionApi.list({ ...params, page, pageSize })),
  });
}

export function useSellerPromotion(id: string) {
  return useQuery({
    queryKey: promotionKeys.sellerDetail(id),
    queryFn: () => promotionApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateSellerPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePromotionBody) => promotionApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion submitted for review");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to create promotion")),
  });
}

export function useUpdateSellerPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePromotionBody }) =>
      promotionApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion updated");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to update promotion")),
  });
}

/* ─── Admin promotions ──────────────────────────────────────────────── */

export function useAdminPromotions(params: ListPromotionsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: promotionKeys.adminList({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage<Promotion>(await adminPromotionApi.list({ ...params, page, pageSize })),
  });
}

export function useAdminPromotion(id: string) {
  return useQuery({
    queryKey: promotionKeys.adminDetail(id),
    queryFn: () => adminPromotionApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateAdminPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePromotionBody) => adminPromotionApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion created");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to create promotion")),
  });
}

export function useUpdateAdminPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdatePromotionBody }) =>
      adminPromotionApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion updated");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to update promotion")),
  });
}

export function useApprovePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPromotionApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion approved");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to approve")),
  });
}

export function useRejectPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminPromotionApi.reject(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: promotionKeys.all });
      toast.success("Promotion rejected");
    },
    onError: (e) => toast.error(promoErrorMessage(e, "Failed to reject")),
  });
}

/* ─── Banners ───────────────────────────────────────────────────────── */

export function usePublicBanners(lang: BannerLang = "VI", enabled = true) {
  return useQuery({
    queryKey: bannerKeys.public(lang),
    queryFn: async () => {
      const data = await bannerApi.publicList(lang);
      return asArray<import("@/lib/api/promotions").Banner>(data);
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useAdminBannersList(params: ListBannersParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return useQuery({
    queryKey: bannerKeys.admin({ ...params, page, pageSize }),
    queryFn: async () =>
      parsePage(await bannerApi.adminList({ ...params, page, pageSize })),
  });
}

export function useCreateBannerMultipart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => bannerApi.adminCreate(formData),
    onSuccess: (_data, formData) => {
      void qc.invalidateQueries({ queryKey: bannerKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      const lang = formData.get("lang");
      toast.success(
        typeof lang === "string"
          ? `Banner created (${lang}) — switch homepage to that language to see it`
          : "Banner created",
      );
    },
    onError: (e) => toast.error(bannerErrorMessage(e, "Failed to create banner")),
  });
}

export function useUpdateBannerMultipart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      bannerApi.adminUpdate(id, formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bannerKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      toast.success("Banner updated");
    },
    onError: (e) => toast.error(bannerErrorMessage(e, "Failed to update banner")),
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bannerApi.adminDelete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bannerKeys.all });
      void qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      toast.success("Banner deleted");
    },
    onError: (e) => toast.error(bannerErrorMessage(e, "Failed to delete banner")),
  });
}

/* ─── Marketing media ───────────────────────────────────────────────── */

export function useMarketingFolders(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: marketingKeys.folders(page, pageSize),
    queryFn: async () =>
      parsePage<MarketingFolder>(await marketingApi.folders({ page, pageSize })),
  });
}

export function useMarketingFolder(folderId: string) {
  return useQuery({
    queryKey: marketingKeys.folder(folderId),
    queryFn: () => marketingApi.folder(folderId),
    enabled: Boolean(folderId),
  });
}

export function useDownloadMarketingFolder() {
  return useMutation({
    mutationFn: async (folderId: string) => {
      const blob = await marketingApi.downloadZip(folderId);
      return { blob, folderId };
    },
    onSuccess: ({ blob, folderId }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marketing-${folderId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    },
    onError: (e) => toast.error(mediaErrorMessage(e, "Download failed")),
  });
}

export function useAdminMarketingFolders(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: marketingKeys.adminFolders(page, pageSize),
    queryFn: async () =>
      parsePage<MarketingFolder>(await marketingApi.adminFolders({ page, pageSize })),
  });
}

export function useAdminMarketingFolder(folderId: string) {
  return useQuery({
    queryKey: marketingKeys.adminFolder(folderId),
    queryFn: () => marketingApi.adminFolder(folderId),
    enabled: Boolean(folderId),
  });
}

export function useCreateMarketingFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateMarketingFolderBody) => marketingApi.adminCreateFolder(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.all });
      toast.success("Folder created");
    },
    onError: (e) => toast.error(mediaErrorMessage(e, "Failed to create folder")),
  });
}

export function useUpdateMarketingFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateMarketingFolderBody }) =>
      marketingApi.adminUpdateFolder(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.all });
      toast.success("Folder updated");
    },
    onError: (e) => toast.error(mediaErrorMessage(e, "Failed to update folder")),
  });
}

export function useUploadMarketingAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, file }: { folderId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return marketingApi.adminUploadAsset(folderId, fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.all });
      toast.success("File uploaded");
    },
    onError: (e) => toast.error(mediaErrorMessage(e, "Upload failed")),
  });
}

export function useDeleteMarketingAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assetId: string) => marketingApi.adminDeleteAsset(assetId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.all });
      toast.success("Asset deleted");
    },
    onError: (e) => toast.error(mediaErrorMessage(e, "Failed to delete asset")),
  });
}
