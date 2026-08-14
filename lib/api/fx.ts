import { api } from "./client";

export type FxRatesResponse = {
  base: string;
  asOf: string;
  source: string;
  rates: Record<string, number>;
  updatedBy: string | null;
};

export type AdminFxRatesResponse = {
  latest: FxRatesResponse;
  history: Array<{
    id: string;
    quoteCurrency: string;
    rate: number;
    effectiveAt: string;
    source: string;
    createdBy: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type UpdateFxRatesBody = {
  rates: { MYR: number; VND: number; SGD: number; USD: number };
  note?: string;
};

export const fxApi = {
  getRates: (base = "TWD") =>
    api.get<FxRatesResponse>("/fx/rates", { query: { base } }),
  adminGetRates: () => api.get<AdminFxRatesResponse>("/admin/fx/rates"),
  adminUpdateRates: (body: UpdateFxRatesBody) =>
    api.put<FxRatesResponse>("/admin/fx/rates", body),
};
