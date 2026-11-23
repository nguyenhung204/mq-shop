# Bộ kiểm thử E2E (Playwright) cho MQ Plaza

Chạy trình duyệt thật (Chromium) trên backend thật, Postgres thật, Redis thật, MinIO thật. Mọi thứ nằm trong một stack **tạm** riêng, không đụng container dev (`mq-postgres`, `mq-redis`, `minio-server`) và không đọc `.env` nào.

## Chạy lại bằng một lệnh

```bash
cd mq-shop
e2e/scripts/run.sh                  # reset DB sạch -> backend -> build + chạy frontend -> toàn bộ test
e2e/scripts/run.sh --retries=0      # tham số thừa được chuyển cho `playwright test`
e2e/scripts/run.sh e2e/specs/08-partial-refund.spec.ts --project=parallel   # chạy một file
```

`run.sh` luôn làm theo thứ tự: tạo lại DB `mq_e2e` từ template -> xóa Redis -> khởi động lại backend (xóa luôn bộ đếm throttler trong bộ nhớ) -> build/chạy frontend -> xóa session cũ -> Playwright. Vì vậy mỗi lần chạy độc lập với lần trước (khóa tài khoản, link mời đã dùng, số lần khiếu nại... không dính sang).

Yêu cầu: Docker, Node >= 20 (đã thử Node 22), pnpm 9, `npx playwright install chromium` (một lần), backend đã `pnpm build` ở `../mq_backend` (script dùng `../mq_backend/dist/main.js`; build lại khi đổi code backend). `pg_dump` trên máy chỉ cần cho test sao lưu thủ công (13b).

Kết quả: báo cáo HTML ở `e2e/.report/`, ảnh chụp lỗi và trace ở `e2e/.results/`, log backend ở `e2e/.run/backend.log`, kết quả ma trận ô nhập tiền ở `e2e/.run/money-inputs/`, axe ở `e2e/.report-extra/axe-summary.json`.

## Stack tạm

| Thành phần | Cách chạy | Cổng |
|---|---|---|
| Postgres 16 | container `mqe2e-pg` (user `e2e`, DB `mq_e2e`, template `mq_e2e_template`) | 55432 |
| Redis 7 | container `mqe2e-redis` | 56379 |
| MinIO | container `mqe2e-minio` (bucket `mq-e2e`) | 59010 |
| Backend | `node ../mq_backend/dist/main.js`, cwd không có `.env`, biến môi trường ở `e2e/env/backend.env` (giá trị chỉ dùng cho test) | 3005 |
| Frontend | `next build` + `next start` với `NEXT_PUBLIC_API_HOST=http://localhost:3005` | 3000 |

Lệnh con của `e2e/scripts/stack.sh`: `infra`, `template`, `reset`, `backend`, `frontend`, `stop`, `clean`.

- `reset`: dựng template (lần đầu: DB trống -> backend chạy migration (TYPEORM_SYNC + migrations) -> `seed:users` + `seed:fx` -> dừng), rồi `CREATE DATABASE mq_e2e TEMPLATE mq_e2e_template`.
- `backend`: chỉ khởi động lại backend (giữ DB và Redis), dùng sau khi sửa `e2e/env/backend.env`.
- `E2E_REBUILD=1 e2e/scripts/stack.sh frontend`: build lại frontend (bắt buộc sau khi đổi code `mq-shop`; `run.sh` chỉ build khi chưa có bản build E2E).
- `E2E_REBUILD_TEMPLATE=1`: dựng lại template (sau khi đổi migration).
- `clean`: dừng tiến trình, xóa 3 container tạm và thư mục `e2e/.run`.

## Dữ liệu seed

1. **Cố định (template):** 7 tài khoản (`superadmin/admin/accountant/cs/warehouse/seller/buyer@example.com`, mật khẩu trong `e2e/support/env.ts`) và 5 tỷ giá TWD sang TWD/USD/VND/MYR/SGD (seed của backend).
2. **Mỗi test tự dựng dữ liệu riêng** qua API thật (`e2e/support/factory.ts`; xem `e2e/support/README-factory.md`): đăng ký + OTP (đọc từ log backend, `OTP_LOG_PLAINTEXT=1`), shop, SKU, tồn kho, đơn, giao hàng, RMA... Email/tên theo bộ đếm tất định, không random trong assert.
3. **Chỉ ghi SQL/gọi service khi API không làm được** (mỗi chỗ có comment `// SQL:` hoặc `// SERVICE:`): lùi `delivered_at/paid_at` (mốc 7 ngày hoa hồng, 48 giờ "Cần xử lý", 30 ngày biên lai), đặt đơn vào quý quá khứ đã khóa, chèn dòng suất vào quý đã khóa, đổi tên shop để thử chống công thức CSV, đổi `buyer_id` để thử SELF_DEALING. Cron/job không có route HTTP được chạy qua tiến trình phụ khởi động DI container của Nest từ `dist` (`support/backend-ctl*.cjs`, `orders-ctl.cjs`), chỉ gọi đúng một bước cần thiết.
4. Trình duyệt dùng `storageState` (đăng nhập một lần mỗi vai ở `global-setup`), tránh giới hạn 5 lần/phút của `/auth/login`. Backend chạy `TRUST_PROXY=1` và mỗi context có `X-Forwarded-For` riêng nên không dính throttler dùng chung 127.0.0.1.

## Hai project

- `parallel`: test độc lập, dữ liệu riêng, chạy song song (3 worker, `E2E_WORKERS` để đổi).
- `serial` (`*.serial.spec.ts`): test đổi trạng thái **toàn cục** (cài đặt, thuế, tỷ giá, tỷ lệ cổ tức, công tắc cổ tức tự cộng, dừng Redis, sao lưu thủ công). Chạy sau project song song, 1 worker, luôn khôi phục trong `finally`. **Serial chỉ chạy khi project song song không còn đỏ** (đó là `dependencies`). Chạy riêng serial: `npx playwright test --project=serial --no-deps`.

## Lưu ý quan trọng

- E2E chạy với `COMMISSION_PAYOUT_HOLD=false` (mặc định sản phẩm là `true`: hoa hồng nằm PENDING, ví không được cộng). Cần vậy để kiểm cộng và thu hồi điểm trên ví. Đường mặc định `hold=true` chưa có E2E riêng.
- `dividend_rates`, lịch sử cài đặt, suất cổ tức là **chỉ thêm** (trigger DB): mỗi lần chạy thêm dòng vĩnh viễn trong DB `mq_e2e`; `run.sh` tạo DB mới mỗi lần nên không tích lũy. Test cổ tức tự động (12) dùng quý trống cuối cùng ≤ 2026Q3; sau nhiều lần chạy trên cùng DB (không reset) có thể hết quý trống: reset DB.
- Test sao lưu thủ công (13b) đặt cờ bảo trì Redis: mọi ghi toàn stack trả 503 trong lúc `pg_dump` chạy, nên nó nằm ở project serial. Test dừng Redis (11b) dừng container `mqe2e-redis` và luôn bật lại ở `finally`.
- Frontend build cho E2E ghi đè `.next`. Khi chạy cổng cuối `NEXT_PUBLIC_API_HOST=https://api.example.com pnpm build` xong thì phải `E2E_REBUILD=1 e2e/scripts/stack.sh frontend` trước lần chạy E2E kế tiếp.
- Công tắc `dividendAutoCreditEnabled` mặc định TẮT; chỉ test 12 bật rồi luôn trả về TẮT và xóa `fromQuarter`.
- `npx eslint .` bỏ qua `e2e/**` (cấu hình riêng); typecheck E2E: `npx tsc --noEmit -p e2e/tsconfig.json`. `tsconfig.json` của app loại `e2e` và `playwright.config.ts`; `pnpm test` (vitest) chỉ quét `lib/**/*.test.ts`.

## Cấu trúc

```
e2e/
  env/backend.env          biến môi trường test của backend
  scripts/run.sh, stack.sh một lệnh / quản lý stack
  support/                 api, db, otp, factory, ui, helper theo nhóm luồng
  specs/NN-*.spec.ts       theo luồng của kịch bản 17 mục
```
