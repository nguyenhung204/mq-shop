import { api } from "./client";
import type { PageMeta, Paginated } from "./types";

export type PromotionType = "PERCENT" | "FIXED" | "FREE_SHIP" | "VOUCHER";
export type PromotionScope = "PLATFORM" | "TARGETED";
export type PromotionStatus = "PENDING" | "ACTIVE" | "REJECTED" | "EXPIRED";
export type BannerLang = "VI" | "EN" | "TW";

export const BANNER_LANGS: BannerLang[] = ["VI", "EN", "TW"];

export const BANNER_LANG_LABELS: Record<BannerLang, string> = {
  VI: "Tiếng Việt",
  EN: "English",
  TW: "繁體中文／台灣",
};

export type Promotion = {
  id: string;
  shopId: string | null;
  createdByUserId: string;
  name: string;
  type: PromotionType;
  discountValue: string;
  code: string | null;
  budget: string | null;
  startAt: string;
  endAt: string;
  scopeType: PromotionScope;
  skus: string[];
  categoryIds: string[];
  status: PromotionStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePromotionBody = {
  name: string;
  type: PromotionType;
  discountValue?: string;
  code?: string;
  budget?: string;
  startAt: string;
  endAt: string;
  scopeType?: PromotionScope;
  skus?: string[];
  categoryIds?: string[];
};

export type UpdatePromotionBody = Partial<CreatePromotionBody>;

export type ListPromotionsParams = {
  status?: PromotionStatus;
  page?: number;
  pageSize?: number;
};

export type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  lang: BannerLang;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ListBannersParams = {
  lang?: BannerLang;
  page?: number;
  pageSize?: number;
};

export type MarketingFolder = {
  id: string;
  name: string;
  description: string | null;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketingAsset = {
  id: string;
  folderId: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type MarketingFolderDetail = MarketingFolder & {
  assets: MarketingAsset[];
};

export type CreateMarketingFolderBody = {
  name: string;
  description?: string;
};

export type UpdateMarketingFolderBody = Partial<CreateMarketingFolderBody>;

type PromotionListRes =
  | Promotion[]
  | { data: Promotion[]; meta?: PageMeta }
  | Paginated<Promotion>;

type BannerListRes = Banner[] | { data: Banner[]; meta?: PageMeta } | Paginated<Banner>;

type FolderListRes =
  | MarketingFolder[]
  | { data: MarketingFolder[]; meta?: PageMeta }
  | Paginated<MarketingFolder>;

/** Seller shop promotions — always TARGETED → PENDING on create. */
export const promotionApi = {
  list: (query?: ListPromotionsParams) =>
    api.get<PromotionListRes>("/promotions", { query, withMeta: true }),
  get: (promotionId: string) => api.get<Promotion>(`/promotions/${promotionId}`),
  create: (body: CreatePromotionBody) => api.post<Promotion>("/promotions", body),
  update: (promotionId: string, body: UpdatePromotionBody) =>
    api.patch<Promotion>(`/promotions/${promotionId}`, body),
};

/** Admin promotions — create → ACTIVE; list pending needs APPROVE_PROMO. */
export const adminPromotionApi = {
  list: (query?: ListPromotionsParams) =>
    api.get<PromotionListRes>("/admin/promotions", { query, withMeta: true }),
  get: (promotionId: string) => api.get<Promotion>(`/admin/promotions/${promotionId}`),
  create: (body: CreatePromotionBody) => api.post<Promotion>("/admin/promotions", body),
  update: (promotionId: string, body: UpdatePromotionBody) =>
    api.patch<Promotion>(`/admin/promotions/${promotionId}`, body),
  approve: (promotionId: string) =>
    api.post<Promotion>(`/admin/promotions/${promotionId}/approve`, {}),
  reject: (promotionId: string, body: { reason: string }) =>
    api.post<Promotion>(`/admin/promotions/${promotionId}/reject`, body),
};

/** Public + admin CMS banners. */
export const bannerApi = {
  /** Public homepage list — no auth. Only active banners for `lang`. */
  publicList: (lang: BannerLang = "VI") =>
    api.get<Banner[]>("/banners", { auth: false, query: { lang } }),
  adminList: (query?: ListBannersParams) =>
    api.get<BannerListRes>("/admin/banners", { query, withMeta: true }),
  adminGet: (bannerId: string) => api.get<Banner>(`/admin/banners/${bannerId}`),
  /** Multipart field `image` (required on create). */
  adminCreate: (formData: FormData) => api.postForm<Banner>("/admin/banners", formData),
  /** Multipart; `image` optional on PATCH. */
  adminUpdate: (bannerId: string, formData: FormData) =>
    api.patchForm<Banner>(`/admin/banners/${bannerId}`, formData),
  adminDelete: (bannerId: string) => api.delete(`/admin/banners/${bannerId}`),
};

/** Marketing media library — folders + ZIP download + admin upload. */
export const marketingApi = {
  folders: (query?: { page?: number; pageSize?: number }) =>
    api.get<FolderListRes>("/marketing/folders", { query, withMeta: true }),
  folder: (folderId: string) =>
    api.get<MarketingFolderDetail>(`/marketing/folders/${folderId}`),
  downloadZip: (folderId: string) =>
    api.getBlob(`/marketing/folders/${folderId}/download`),
  adminFolders: (query?: { page?: number; pageSize?: number }) =>
    api.get<FolderListRes>("/admin/marketing/folders", { query, withMeta: true }),
  adminCreateFolder: (body: CreateMarketingFolderBody) =>
    api.post<MarketingFolder>("/admin/marketing/folders", body),
  adminUpdateFolder: (folderId: string, body: UpdateMarketingFolderBody) =>
    api.patch<MarketingFolder>(`/admin/marketing/folders/${folderId}`, body),
  adminFolder: (folderId: string) =>
    api.get<MarketingFolderDetail>(`/admin/marketing/folders/${folderId}`),
  /** Multipart field `file` ≤ 20MB. */
  adminUploadAsset: (folderId: string, formData: FormData) =>
    api.postForm<MarketingAsset>(`/admin/marketing/folders/${folderId}/assets`, formData),
  adminDeleteAsset: (assetId: string) => api.delete(`/admin/marketing/assets/${assetId}`),
};
