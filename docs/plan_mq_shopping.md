# PROJECT PLAN — MQ SHOPPING (Multi-vendor E-commerce Platform)

> Tài liệu này tổng hợp từ 10 flow nghiệp vụ do khách hàng cung cấp + các buổi làm rõ yêu cầu (Q&A).
> Các mục đánh dấu **[GIẢ ĐỊNH]** là do BA/Dev tự đề xuất theo best practice vì chưa có câu trả lời chính thức từ khách hàng — cần review lại khi có yêu cầu nghiệp vụ cụ thể hơn.
> Các mục đánh dấu **✅ [ĐÃ CHỐT]** là các điểm khách hàng đã xác nhận rõ ràng, không còn là giả định.

### 📝 CHANGELOG — Cập nhật so với bản trước

| Module | Thay đổi |
|---|---|
| Module 4 (Kho) | **Bỏ bước Admin duyệt** khi phiếu do chính Seller/Admin tạo (tự động APPROVED ngay, cập nhật tồn kho tức thì). Chỉ phiếu do **NV Kho** tạo mới cần **Seller** (không phải Admin sàn) duyệt. Vẫn giữ cơ chế chặn âm kho tự động. Thông báo chỉ in-app, không email. |
| Module 5 (RMA) | **Seller không còn quyền duyệt/từ chối RMA.** Seller chỉ có 3 ngày tự thương lượng với Buyer ngoài hệ thống. Sau 3 ngày, hệ thống **tự động APPROVED** nếu Buyer không đổi ý. Admin có quyền can thiệp/hủy ngay lập tức, không cần chờ 3 ngày. |
| Module 5 (RMA kho) | **✅ [ĐÃ CHỐT 2026-07-15]** Cộng kho **chỉ** khi hàng đã về tay Seller. Seller **tự input** số lượng + ghi chú loại hàng (**hàng trả lại** / **hàng mới**) rồi bấm Confirm → hệ thống mới cộng `available_stock`. Không còn phân nhánh GOOD/DAMAGED tự động quyết định có cộng hay không. |
| Module 1 (Authen) | Chốt chính thức: xóa tài khoản = **Soft-delete, giữ dữ liệu vĩnh viễn** (đính chính từ câu trả lời "hard delete" trước đó). |
| Module 9 (MLM/Wallet) | **✅ [ĐÃ CHỐT]** P2P + Rút tiền **làm đầy đủ** giai đoạn này. P2P = **Mật khẩu + OTP Email**. Rút tiền = tạo lệnh → Admin duyệt → danh sách cho Kế toán chi ngoài hệ thống → Admin/Kế toán **xác nhận "đã chi tiền"** (hệ thống chỉ ghi nhận). **Không dùng PIN cấp 2.** Công thức % F-level → khảo sát sau (blocker tính hoa hồng chi tiết). |
| Module 3 (Product) | Xác nhận chính thức SKU **unique theo `(shop_id, sku)`** — không cần check trùng xuyên Shop. |

---

## 0. TỔNG QUAN DỰ ÁN

MQ Shopping là sàn thương mại điện tử **multi-vendor** (nhiều người bán), phục vụ đa quốc gia (Việt Nam, Đài Loan, Singapore, Malaysia), có tích hợp hệ thống **hoa hồng giới thiệu (MLM)** và **ví điểm thưởng** nội bộ.

### Danh sách 10 module (feature) chính

| # | Module | Vai trò chính liên quan |
|---|---|---|
| 1 | Authentication & Account Management | Buyer, Seller, Admin, Super Admin |
| 2 | Shop Management (Gian hàng) | Buyer→Seller, Admin |
| 3 | Product Listing (Sản phẩm) | Seller, Admin, Buyer |
| 4 | Inventory Management (Kho & Tồn) | Seller, NV Kho, Admin |
| 5 | Order Management (Đơn hàng, Hủy, RMA) | Buyer, Seller, Admin, CSKH |
| 6 | Marketing & Promotion (Khuyến mãi) | Seller, Admin — *phần lớn Out of Scope giai đoạn này* |
| 7 | CMS (Banner) & Marketing Materials | Admin |
| 8 | Payment & Finance (Payout, Cấu hình cổng TT, Báo cáo) | Kế toán, Admin, Super Admin |
| 9 | MLM & E-Wallet (Hoa hồng, Ví điểm, P2P, Rút tiền) | Mọi role, Kế toán, Admin |
| 10 | System Administration (Phân quyền, Audit Log, Backup, Data Privacy) | Admin, Super Admin |

### Nguyên tắc xuyên suốt toàn hệ thống (đã chốt)

1. **Multi-role**: 1 tài khoản có thể vừa là Buyer vừa là Seller. Không dùng cột `role` đơn (enum), dùng bảng quan hệ `user_roles` (many-to-many). UI/chức năng hiển thị theo role đang active.
2. **Đa ngôn ngữ (I18n)**: áp dụng **toàn hệ thống** (không riêng Banner) — Tiếng Việt (VI), Tiếng Anh (EN — dùng chung cho Singapore/Malaysia/quốc tế), Tiếng Trung phồn thể (ZH-TW — Đài Loan). Mọi bảng có nội dung do người dùng nhập (tên sản phẩm, tên Shop, mô tả, lý do từ chối...) cần thiết kế dạng đa ngôn ngữ (bảng `_translations` riêng hoặc cột JSON).
3. **Đa tiền tệ**: **USD là đơn vị tiền tệ gốc** dùng lưu trữ & tính toán nội bộ (giá sản phẩm, doanh thu, Payout, Ví điểm). Tiền tệ địa phương (VND/TWD/SGD/MYR) chỉ dùng ở tầng hiển thị, quy đổi theo tỷ giá.
4. **Hệ thống chỉ ghi nhận, không xử lý fintech thật**: mọi giao dịch tiền thật (hoàn tiền khi hủy đơn, chuyển khoản khi rút tiền) đều dừng ở bước hệ thống ghi nhận + Admin/Kế toán duyệt. Việc chuyển tiền thật là thao tác thủ công bên ngoài hệ thống, sau đó quay lại đánh dấu "đã hoàn tất" bằng tay.
5. **Audit Log**: giai đoạn 1 chỉ ghi log các hành động **nhạy cảm** (duyệt/từ chối, đổi quyền, xóa, giao dịch tiền, khóa/mở khóa). Chưa cần log toàn bộ API write.
6. **Xóa tài khoản = Soft-delete** — ✅ **[ĐÃ CHỐT CHÍNH THỨC]**: khách hàng xác nhận dữ liệu người dùng khi bị "xóa" cần **giữ lại vĩnh viễn** để tra cứu sau này. Vậy khi Admin "xóa" tài khoản, hệ thống chỉ đổi `status = DELETED`, chặn đăng nhập, **không xóa bất kỳ dữ liệu nào** (đơn hàng, giao dịch, lịch sử...). Không hard-delete. (Lưu ý: câu trả lời "hard delete" ở một buổi trao đổi trước đó đã được khách hàng đính chính lại thành "giữ lại vĩnh viễn" — plan chốt theo câu trả lời sau cùng này.)
7. **Yêu cầu xóa dữ liệu cá nhân (Anonymization)**: không có form tự yêu cầu trong app — khách phải liên hệ Admin thủ công, Admin/Super Admin thực hiện qua flow riêng ở module System Admin.
8. **Giỏ hàng chỉ 1 Shop / đơn hàng**: không cho phép checkout đa Shop trong 1 lần để giảm rủi ro nghiệp vụ.
9. **Timeout giữ chỗ tồn kho**: đơn ở PENDING chưa thanh toán quá **30 ngày** → tự động release `reserved_stock` về `available_stock`.
10. **Model kho**: `available_stock` tính **riêng theo từng Warehouse** (không gộp tổng).

---

## 1. MODULE: AUTHENTICATION & ACCOUNT MANAGEMENT

### 1.1 Mục tiêu
Cho phép người dùng đăng ký/đăng nhập, Admin quản lý (khóa/mở khóa/xóa) tài khoản, và người dùng tự cập nhật hồ sơ cá nhân — với cơ chế bảo mật đầy đủ (OTP, đổi mật khẩu, đổi thông tin nhạy cảm).

### 1.2 Phạm vi (Scope)

**Đăng ký & Đăng nhập**
- Đăng ký bằng SĐT/Email + Mật khẩu.
- **Xác thực OTP qua Email bắt buộc** trước khi kích hoạt tài khoản (không xác thực qua SĐT).
- Đăng nhập bằng SĐT/Email + Mật khẩu, trả về Access Token + Refresh Token (JWT).
- Gán role mặc định = BUYER khi đăng ký.

**Quản lý tài khoản (Admin)**
- Khóa (LOCKED) / Mở khóa (UNLOCK) tài khoản.
- Xóa tài khoản = **Soft-delete** (status = DELETED, chặn đăng nhập, giữ dữ liệu lịch sử).
- Gửi thông báo Email cho người dùng khi bị khóa/mở khóa/xóa.

**Hồ sơ cá nhân (Self-service)**
- Xem/sửa thông tin cá nhân (Avatar, Họ tên, Ngày sinh).
- **Đổi mật khẩu**: tự thực hiện, không cần Admin duyệt (yêu cầu nhập mật khẩu cũ + mật khẩu mới).
- **Đổi SĐT/Email**: bắt buộc xác thực OTP qua Email trước khi lưu thay đổi.

### 1.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-AUTH-01 | SĐT/Email không được trùng với tài khoản đang tồn tại (kể cả khi tài khoản đó đang PENDING/LOCKED — chỉ tài khoản DELETED mới cho phép SĐT/Email đó được đăng ký lại). |
| BR-AUTH-02 | Mật khẩu tối thiểu 8 ký tự, có chữ hoa + số. **[GIẢ ĐỊNH]** — cần khách xác nhận policy cụ thể. |
| BR-AUTH-03 | Tài khoản chưa xác thực OTP Email sau **24 giờ [GIẢ ĐỊNH]** sẽ tự động bị xóa (cleanup job) để tránh rác dữ liệu. |
| BR-AUTH-04 | Khi đổi SĐT/Email, phải xác thực OTP gửi tới **Email hiện tại**, tránh chiếm đoạt tài khoản. **[GIẢ ĐỊNH — cần khách xác nhận]**: gửi OTP tới email cũ hay email mới? |
| BR-AUTH-05 | Khi tài khoản bị LOCKED/DELETED, toàn bộ Access Token & Refresh Token hiện tại bị đưa vào Redis Blacklist ngay lập tức (Force Logout). |
| BR-AUTH-06 | Đổi mật khẩu thành công → Force Logout tất cả thiết bị khác (trừ thiết bị hiện tại). |

### 1.4 Database Schema (đề xuất)

```
users
- id (PK)
- email (unique, not null)
- phone (nullable)
- password_hash
- full_name
- avatar_url
- date_of_birth
- status (ENUM: PENDING_VERIFY, ACTIVE, LOCKED, DELETED)
- email_verified_at
- created_at, updated_at

user_roles                      -- multi-role
- user_id (FK -> users)
- role (ENUM: BUYER, SELLER, ADMIN, SUPER_ADMIN)
- PRIMARY KEY (user_id, role)

otp_requests
- id (PK)
- user_id (FK)
- otp_code_hash
- purpose (ENUM: REGISTER, CHANGE_EMAIL, CHANGE_PHONE, RESET_PASSWORD)
- expires_at
- consumed_at
```

### 1.5 API chính (đề xuất)

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/auth/register` | Đăng ký, trả về PENDING, gửi OTP email |
| POST | `/api/v1/auth/verify-otp` | Xác thực OTP kích hoạt tài khoản |
| POST | `/api/v1/auth/login` | Đăng nhập |
| POST | `/api/v1/auth/refresh-token` | Cấp lại access token |
| POST | `/api/v1/auth/logout` | Logout, blacklist token |
| POST | `/api/v1/auth/forgot-password` | Quên mật khẩu (gửi OTP email) |
| POST | `/api/v1/auth/reset-password` | Đặt lại mật khẩu bằng OTP |
| PUT | `/api/v1/users/me/password` | Đổi mật khẩu (đã đăng nhập) |
| PUT | `/api/v1/users/me/profile` | Cập nhật hồ sơ (avatar, tên, ngày sinh) |
| POST | `/api/v1/users/me/change-email/request-otp` | Yêu cầu OTP đổi email |
| PUT | `/api/v1/users/me/change-email/confirm` | Xác nhận đổi email bằng OTP |
| PUT | `/api/v1/admin/users/{id}/lock` | Admin khóa tài khoản |
| PUT | `/api/v1/admin/users/{id}/unlock` | Admin mở khóa |
| DELETE | `/api/v1/admin/users/{id}` | Admin xóa (soft-delete) |

### 1.6 Test Cases tiêu biểu
- Đăng ký với Email đã tồn tại → 409 Conflict.
- Đăng ký thành công nhưng không xác thực OTP trong 24h → tài khoản bị dọn dẹp tự động.
- Đổi mật khẩu sai mật khẩu cũ → 400.
- Đổi Email thành công → token cũ bị blacklist, phải đăng nhập lại.
- Admin khóa tài khoản đang có phiên đăng nhập active → user bị logout ngay ở request tiếp theo.
- User đã bị soft-delete cố đăng nhập lại → báo lỗi tài khoản không tồn tại/đã bị xóa.

### 1.7 Out of Scope giai đoạn này
- Đăng nhập qua mạng xã hội (Google/Facebook OAuth).
- Xác thực 2 lớp (2FA) cho tài khoản thường (khác với PIN cấp 2 của Ví — xem Module 9).

---

## 2. MODULE: SHOP MANAGEMENT (GIAN HÀNG)

### 2.1 Mục tiêu
Cho phép Buyer nộp hồ sơ trở thành Người bán (Seller), Admin duyệt/từ chối hồ sơ, và quản lý vòng đời của Shop (kể cả khi bị khóa do vi phạm).

### 2.2 Phạm vi

**Buyer nộp hồ sơ mở Shop**
- Nhập Tên Shop, Mã số thuế, Địa chỉ lấy hàng, tải giấy tờ (ảnh thường, dung lượng do Dev tối ưu, không cần security scan).
- 1 tài khoản chỉ được sở hữu **1 Shop**.
- Nếu hồ sơ trước đó bị **REJECTED**, được phép nộp lại hồ sơ mới → thông báo cho Admin.
- Mã số thuế: input tối đa 15 số, chỉ cảnh báo định dạng (không validate chuẩn theo từng quốc gia).
- Check trùng **Mã số thuế theo phạm vi từng quốc gia** (trùng khác quốc gia thì không sao); nếu trùng → báo lỗi màu đỏ: *"Mã số thuế bị trùng tại quốc gia XX, vui lòng kiểm tra lại"*.
- Check trùng Tên Shop (không phân biệt hoa/thường).

**Admin duyệt hồ sơ**
- APPROVE → gán thêm role SELLER cho user (multi-role, giữ nguyên role BUYER).
- REJECT → bắt buộc nhập lý do (tối đa 150 ký tự, áp dụng mọi ngôn ngữ).
- Không có SLA thời gian duyệt — hệ thống gửi thông báo nhắc liên tục cho Admin cho tới khi hồ sơ được xử lý xong (dựa theo STATUS).

**Quản lý Shop sau khi ACTIVE**
- Khi Shop vi phạm → Admin chuyển trạng thái **APPROVED → REJECTED/SUSPENDED**: khóa Shop, yêu cầu Seller liên hệ Admin, đồng thời hệ thống thông báo liên tục cho Admin theo cơ chế STATUS tương tự trên.

### 2.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-SHOP-01 | 1 User = tối đa 1 Shop (tại 1 thời điểm, không tính hồ sơ REJECTED cũ). |
| BR-SHOP-02 | 1 Mã số thuế = tối đa 1 Shop, **trong phạm vi cùng 1 quốc gia**. |
| BR-SHOP-03 | Tên Shop unique, không phân biệt hoa/thường. |
| BR-SHOP-04 | Lý do REJECT bắt buộc nhập, tối đa 150 ký tự/ngôn ngữ. |
| BR-SHOP-05 | Shop bị SUSPENDED → toàn bộ sản phẩm của Shop tự động ẩn khỏi tìm kiếm (điều kiện ngầm ở Module 3 đã check `Shops.status = APPROVED AND is_suspended = false`). |
| BR-SHOP-06 | User vẫn giữ role BUYER sau khi được duyệt SELLER — multi-role, UI thay đổi theo role đang chọn. |

### 2.4 Database Schema (đề xuất)

```
shops
- id (PK)
- owner_user_id (FK -> users, unique)
- name
- tax_code
- country_code            -- ISO country, dùng để scope check trùng tax_code
- pickup_address
- legal_document_url
- status (ENUM: PENDING, APPROVED, REJECTED, SUSPENDED)
- is_suspended (bool)      -- tách riêng cờ suspend khỏi status APPROVED
- rejection_reason (JSON đa ngôn ngữ)
- created_at, updated_at

shop_status_logs           -- lịch sử duyệt/từ chối/suspend, phục vụ thông báo lặp lại
- id, shop_id, from_status, to_status, actor_id, reason, created_at
```

### 2.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/shops/apply` | Buyer nộp hồ sơ mở Shop |
| GET | `/api/v1/admin/shops?status=PENDING` | Danh sách hồ sơ chờ duyệt |
| GET | `/api/v1/admin/shops/{id}` | Chi tiết 1 hồ sơ |
| PUT | `/api/v1/admin/shops/{id}/approve` | Duyệt |
| PUT | `/api/v1/admin/shops/{id}/reject` | Từ chối (bắt buộc `reason`) |
| PUT | `/api/v1/admin/shops/{id}/suspend` | Khóa Shop vi phạm |
| PUT | `/api/v1/shops/me` | Seller tự cập nhật thông tin Shop |

### 2.6 Test Cases tiêu biểu
- Nộp hồ sơ với Mã số thuế trùng trong cùng quốc gia → báo lỗi đỏ đúng message.
- Nộp hồ sơ với Mã số thuế trùng nhưng khác quốc gia → cho phép.
- Hồ sơ bị REJECTED → nộp lại hồ sơ mới thành công, Admin nhận thông báo.
- Admin REJECT không nhập lý do → 400 Bad Request.
- User đã có Shop APPROVED cố nộp hồ sơ mới → chặn.
- Shop bị SUSPENDED → sản phẩm của Shop biến mất khỏi kết quả tìm kiếm ngay lập tức.

### 2.7 Out of Scope
- Đăng ký nhiều Shop trên 1 tài khoản.
- Chuyển quyền sở hữu Shop sang chủ khác.

---

## 3. MODULE: PRODUCT LISTING (SẢN PHẨM)

### 3.1 Mục tiêu
Seller tạo/sửa sản phẩm, Admin duyệt trước khi hiển thị công khai, Buyer tìm kiếm/xem sản phẩm.

### 3.2 Phạm vi

**Seller tạo/sửa sản phẩm**
- Bắt buộc kiểm tra `Shop.status = APPROVED AND is_suspended = false` trước khi cho tạo/sửa (đã bổ sung, khắc phục lỗ hổng của flow gốc).
- Nhập Tên, Danh mục, Ảnh (< 5MB/ảnh), Giá (nhập bằng USD — xem nguyên tắc đa tiền tệ), SKU, Số lượng.
- SKU **unique theo phạm vi từng Shop** (cặp `shop_id + sku`), không giới hạn toàn hệ thống — **✅ [ĐÃ CHỐT]**: SKU là hình thức quản lý hàng hóa nội bộ của từng Seller, không liên quan/hợp nhất với Seller khác nên không cần check trùng xuyên Shop. Nếu sau này có lý do kỹ thuật cần đổi sang unique toàn hệ thống, sẽ quyết định lại ở giai đoạn đó.
- Tạo mới → luôn vào trạng thái **PENDING**, chờ Admin duyệt trước khi ACTIVE.
- Cập nhật (PUT): nếu đổi **trường nhạy cảm** (name, images, category_id) → chuyển lại về PENDING, ẩn khỏi sàn cho tới khi duyệt lại; nếu chỉ đổi trường thường (giá, mô tả nhỏ...) → giữ nguyên status hiện tại.
- Khi bị REJECTED, Seller được sửa và nộp lại (tự động chuyển về PENDING).
- Admin và Seller đều có quyền **ẩn sản phẩm khỏi sàn** bất kỳ lúc nào (is_hidden), độc lập với status duyệt.

**Admin duyệt sản phẩm**
- APPROVE → status = ACTIVE.
- REJECT → bắt buộc lý do.

**Buyer tìm kiếm sản phẩm**
- Chỉ hiển thị sản phẩm thỏa: `status = ACTIVE AND is_hidden = false AND Shop.status = APPROVED AND Shop.is_suspended = false`.
- Sản phẩm hết hàng (stock = 0): **vẫn hiển thị**, nhưng ảnh sản phẩm bị phủ 1 lớp mờ ghi "Đang bổ sung hàng / Restocking" (tùy theo ngôn ngữ hiển thị).

### 3.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-PROD-01 | Chặn tạo/sửa sản phẩm nếu Shop không ACTIVE. |
| BR-PROD-02 | SKU unique theo `(shop_id, sku)`. |
| BR-PROD-03 | Đổi trường nhạy cảm (name/images/category_id) → bắt buộc duyệt lại; đổi trường khác (giá, mô tả, số lượng hiển thị...) → giữ nguyên status. |
| BR-PROD-04 | REJECT bắt buộc nhập lý do. |
| BR-PROD-05 | Sản phẩm hết hàng vẫn index tìm kiếm được, chỉ overlay UI "Restocking", không ẩn khỏi kết quả. |
| BR-PROD-06 | Ẩn sản phẩm (`is_hidden`) là hành động độc lập, Admin hoặc Seller (chủ shop) đều có quyền, không ảnh hưởng tới `status` duyệt. |

### 3.4 Database Schema (đề xuất)

```
products
- id (PK)
- shop_id (FK)
- category_id (FK)
- sku
- price_usd (decimal)      -- giá gốc lưu bằng USD
- stock_summary (cache, tổng từ inventory theo warehouse - chỉ để hiển thị nhanh)
- status (ENUM: PENDING, ACTIVE, REJECTED)
- is_hidden (bool)
- rejection_reason (JSON đa ngôn ngữ)
- created_at, updated_at
- UNIQUE (shop_id, sku)

product_translations
- product_id (FK), locale (VI/EN/ZH-TW), name, description

product_images
- id, product_id, url, sort_order
```

### 3.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/seller/products` | Tạo sản phẩm (POST) |
| PUT | `/api/v1/seller/products/{id}` | Cập nhật sản phẩm |
| PUT | `/api/v1/seller/products/{id}/hide` | Seller tự ẩn sản phẩm |
| GET | `/api/v1/admin/products?status=PENDING` | Danh sách chờ duyệt |
| PUT | `/api/v1/admin/products/{id}/approve` | Duyệt |
| PUT | `/api/v1/admin/products/{id}/reject` | Từ chối |
| PUT | `/api/v1/admin/products/{id}/hide` | Admin ẩn sản phẩm |
| GET | `/api/v1/products/search` | Tìm kiếm công khai (ElasticSearch) |
| GET | `/api/v1/products/{id}` | Chi tiết sản phẩm |

### 3.6 Test Cases tiêu biểu
- Shop bị SUSPENDED, Seller cố tạo sản phẩm mới → 403.
- Tạo SKU trùng trong cùng Shop → 409; SKU trùng nhưng khác Shop → cho phép.
- Sửa giá (không đổi trường nhạy cảm) khi đang ACTIVE → giữ nguyên ACTIVE, không cần duyệt lại.
- Sửa tên sản phẩm khi đang ACTIVE → chuyển về PENDING, ẩn khỏi tìm kiếm.
- Sản phẩm stock = 0 → vẫn xuất hiện trong kết quả tìm kiếm, có overlay "Restocking".

### 3.7 Out of Scope
- Review/đánh giá sản phẩm (chưa có flow — cần bổ sung nếu có yêu cầu).
- Biến thể sản phẩm phức tạp (size/màu dạng ma trận) — giả định mỗi biến thể = 1 SKU/sản phẩm riêng.

---

## 4. MODULE: INVENTORY MANAGEMENT (KHO & TỒN)

### 4.1 Mục tiêu
Quản lý tồn kho theo từng Warehouse của Seller, với cơ chế phiếu Nhập/Điều chỉnh có 2-phase approval để đảm bảo kiểm soát nội bộ.

### 4.2 Phạm vi

**Warehouse**
- Mỗi Shop có thể có nhiều Warehouse; mỗi Warehouse có địa chỉ (input tay + link Google Maps tùy chọn, không cần verify).
- `available_stock` tính **riêng theo từng cặp (warehouse_id, sku)** — không gộp tổng nhiều kho.

**Tạo phiếu Nhập/Điều chỉnh**
- Seller/Admin/NV Kho chỉ được tạo phiếu cho Warehouse **thuộc Shop của chính mình** (check `shop_id`).
- Loại giao dịch tách rõ: `IN` (nhập, luôn dương) / `ADJUST_IN` (điều chỉnh tăng) / `ADJUST_OUT` (điều chỉnh giảm) — số lượng nhập luôn là số dương, dấu +/- do backend tự xác định theo loại giao dịch.

**✅ [ĐÃ CHỐT — cập nhật quan trọng]** Cơ chế duyệt phiếu theo người tạo:
- **Nếu người tạo phiếu là Seller (chủ Shop) hoặc Admin**: phiếu được **tự động duyệt ngay (self-approve)**, `available_stock` được cộng/trừ **ngay lập tức**, không cần chờ ai duyệt thêm — vì "kho của ai người đó tự chịu trách nhiệm quản lý".
- **Nếu người tạo phiếu là Nhân viên Kho (NV Kho)**: phiếu vào trạng thái **PENDING**, cần **Seller (chủ Shop mà NV Kho đó trực thuộc) duyệt** trước khi tồn kho thật được cập nhật (không phải Admin sàn duyệt — đây là kiểm soát nội bộ trong phạm vi 1 Shop).
- Trong cả 2 trường hợp, hệ thống đều **check chặn âm kho tự động**: nếu kết quả sau khi trừ `available_stock < 0` → từ chối thao tác ngay (báo lỗi), không cho phép hoàn tất.
- **Thông báo**: chỉ hiển thị **trên hệ thống (in-app)**, không gửi email/SMS. Chỉ áp dụng khi phiếu do NV Kho tạo (vì cần Seller biết để duyệt/xem kết quả); nếu Seller/Admin tự tạo và tự duyệt luôn thì không cần thông báo thêm.

### 4.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-INV-01 | Seller/Admin/NV Kho chỉ tạo được phiếu cho Warehouse thuộc Shop mình — enforce `WHERE shop_id = {user_shop_id}`. |
| BR-INV-02 | Số lượng nhập vào phiếu luôn dương; loại giao dịch (IN/ADJUST_IN/ADJUST_OUT) quyết định dấu khi tính toán tồn kho thật. |
| BR-INV-03 | Phiếu do Seller/Admin tạo → **tự động APPROVED ngay**, cập nhật tồn kho tức thì. Phiếu do NV Kho tạo → PENDING, chờ Seller duyệt. |
| BR-INV-04 | Bất kỳ thao tác nào (tự động hay do Seller duyệt) dẫn đến `available_stock < 0` → **chặn thực hiện**, báo lỗi rõ ràng. |
| BR-INV-05 | `available_stock` khóa theo `(warehouse_id, sku)`, dùng SELECT FOR UPDATE khi cộng/trừ để tránh race condition — áp dụng cho cả trường hợp tự động duyệt. |
| BR-INV-06 | Thông báo kết quả duyệt chỉ gửi in-app, không email/SMS; chỉ áp dụng cho luồng NV Kho tạo phiếu → cần bảng liên kết NV Kho ↔ Shop để xác định người nhận thông báo và người có quyền duyệt (Seller). |

### 4.4 Database Schema (đề xuất)

```
warehouses
- id (PK), shop_id (FK), name, address_text, google_maps_url (nullable)

inventory
- warehouse_id (FK), sku, available_stock, reserved_stock
- PRIMARY KEY (warehouse_id, sku)

warehouse_staff                 -- liên kết NV Kho với Shop, phục vụ xác định người duyệt/nhận thông báo
- user_id (FK -> users), shop_id (FK -> shops)

inventory_requests
- id (PK), warehouse_id (FK), sku, quantity, request_type (ENUM: IN, ADJUST_IN, ADJUST_OUT)
- reason, evidence_document_url
- created_by_role (ENUM: SELLER, ADMIN, WAREHOUSE_STAFF)
- status (ENUM: APPROVED, PENDING, REJECTED)   -- APPROVED tức thì nếu created_by_role != WAREHOUSE_STAFF
- created_by (FK -> users), approved_by (FK -> users, nullable nếu tự động)
- created_at, approved_at

stock_ledgers               -- read-only audit trail
- id, warehouse_id, sku, change_qty, balance_after, request_id, created_at
```

### 4.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/inventory?is_low_stock=true` | Xem tồn kho (scope theo shop_id nếu là Seller) |
| POST | `/api/v1/inventory/requests` | Tạo phiếu — tự động APPROVED nếu là Seller/Admin, PENDING nếu là NV Kho |
| GET | `/api/v1/seller/inventory/requests?status=PENDING` | Seller xem danh sách phiếu do NV Kho tạo, chờ duyệt |
| PUT | `/api/v1/seller/inventory/requests/{id}/approve` | Seller duyệt phiếu của NV Kho |
| PUT | `/api/v1/seller/inventory/requests/{id}/reject` | Seller từ chối phiếu của NV Kho |

### 4.6 Test Cases tiêu biểu
- NV Kho tạo phiếu cho Warehouse không thuộc Shop mình → 403.
- Seller tự tạo phiếu Nhập → tồn kho cập nhật ngay lập tức, không cần bước duyệt riêng.
- NV Kho tạo phiếu → status PENDING, Seller nhận thông báo in-app, tồn kho **chưa** thay đổi cho tới khi Seller duyệt.
- Seller tự tạo phiếu ADJUST_OUT vượt quá tồn kho hiện có → bị chặn ngay tại thời điểm tạo (vì tự động duyệt).
- 2 phiếu cùng SKU/Warehouse được xử lý đồng thời (1 từ Seller tự động, 1 Seller duyệt cho NV Kho) → không bị lệch số liệu (nhờ SELECT FOR UPDATE).

### 4.7 Out of Scope
- Chuyển kho giữa 2 Warehouse trong cùng 1 Shop (transfer nội bộ) — có thể bổ sung sau nếu cần.

---

## 5. MODULE: ORDER MANAGEMENT (ĐƠN HÀNG)

### 5.1 Mục tiêu
Xử lý toàn bộ vòng đời đơn hàng: đặt hàng, thanh toán, cập nhật vận chuyển, hủy đơn, đổi trả/hoàn tiền — với ranh giới rõ ràng "hệ thống chỉ ghi nhận, không xử lý fintech thật".

### 5.2 Phạm vi

**Đặt hàng (Checkout)**
- Luồng chuẩn: Giỏ hàng → chọn sản phẩm trong giỏ → xác nhận thanh toán → hệ thống kiểm tra kết quả thanh toán → tạo đơn hàng.
- **Chỉ 1 Shop / đơn hàng** — không hỗ trợ giỏ hàng đa Shop.
- Phương thức thanh toán do khách chọn lúc checkout:
  - **Tiền mặt (COD)**: đơn tạo ở PENDING, Admin có quyền can thiệp hủy/hoàn tất đơn thủ công (vì có thể khách tự chuyển khoản thẳng cho Admin ngoài hệ thống).
  - **Chuyển khoản/Thẻ**: đi theo luồng xử lý của bên cổng thanh toán tích hợp (webhook xác nhận PAY_SUCCESS/FAILED).
- Khóa tồn kho bằng `SELECT FOR UPDATE`, trừ `available_stock` + cộng `reserved_stock` ngay khi tạo đơn.
- Đơn PENDING quá **30 ngày** không hoàn tất thanh toán → tự động release `reserved_stock` về `available_stock`, hủy đơn.
- Phí vận chuyển: **[CẦN SPIKE KỸ THUẬT]** — nghiên cứu khả năng tích hợp API tính phí của đơn vị vận chuyển thật; nếu không khả thi, xây dựng bảng phí nội bộ làm phương án dự phòng.
- Khuyến mãi/Voucher: **Out of Scope** giai đoạn này — chỉ chuẩn bị sẵn cấu trúc quyền hạn (permission) tạo/sửa/xóa để dùng khi triển khai sau.

**Cập nhật vận chuyển**
- Cập nhật trạng thái qua **API/Webhook tích hợp với đơn vị vận chuyển** (không phải Seller tự tay bấm cập nhật thủ công).
- Khi status = DELIVERED: trừ dứt điểm `reserved_stock`, **tạm ghi nhận** doanh thu cho Seller (chưa phải doanh thu thực — xem cơ chế 7 ngày ở Module 9).

**Hủy đơn hàng**
- Buyer/Seller/NV CSKH được yêu cầu hủy khi đơn còn ở giai đoạn trước khi giao cho ĐVVC.
- **Admin có toàn quyền tự hủy đơn thay khách bất kỳ lúc nào, không cần thông báo hay ai duyệt, thực hiện ngay lập tức** (nhưng vẫn ghi Audit Log vì đây là hành động nhạy cảm).
- Hoàn kho: trả `reserved_stock` về `available_stock`.
- Hoàn tiền (nếu đã thanh toán online): **hệ thống KHÔNG tự động giải ngân** — chỉ xuất báo cáo hằng ngày cho Admin/Kế toán để họ tự đối chiếu và hoàn tiền thủ công bên ngoài hệ thống.

**RMA (Đổi trả/Hoàn tiền) — ✅ [ĐÃ CHỐT — cập nhật quan trọng: Seller KHÔNG có quyền quyết định]**
- Điều kiện: chỉ được yêu cầu trong vòng **7 ngày** kể từ khi đơn DELIVERED.
- Buyer gửi yêu cầu (lý do, bằng chứng, thông tin tài khoản nhận hoàn tiền) → **Seller chỉ nhận thông báo, KHÔNG có quyền tự ý đồng ý/từ chối yêu cầu trong hệ thống**. Seller có đúng **3 ngày** để tự liên hệ, thương lượng trực tiếp với Buyer (ngoài phạm vi hệ thống, ví dụ qua chat/điện thoại riêng).
- **Sau 3 ngày kể từ khi tạo yêu cầu**, nếu Buyer không có thay đổi/rút yêu cầu → **hệ thống tự động chuyển trạng thái sang APPROVED** (không cần ai bấm duyệt) — coi như RMA mặc định được chấp thuận.
- **Admin có quyền hủy/can thiệp vào bất kỳ đơn hàng hoặc yêu cầu RMA nào của bất kỳ tài khoản nào, thực hiện ngay lập tức, không cần chờ đủ 3 ngày** — đây là quyền độc lập, không phụ thuộc luồng tự động ở trên. Tình huống nào tới trước (Admin can thiệp, hoặc hệ thống tự động duyệt sau 3 ngày) thì xử lý theo tình huống đó trước.
- Khi hàng vật lý được Seller nhận lại: **✅ [ĐÃ CHỐT]** hệ thống **chỉ cộng `available_stock` sau khi Seller tự tay Confirm**. Seller **tự input** số lượng cộng lại + **ghi chú loại hàng** (`RETURNED` = hàng trả lại / `NEW` = hàng mới — hoặc note tự do) rồi ấn Confirm. Hệ thống **không** tự động cộng kho theo GOOD/DAMAGED; không có rule “hàng hỏng thì không cộng” — việc cộng bao nhiêu / ghi chú thế nào do Seller quyết định tại thời điểm hàng đã về tay.
- Hoàn tiền RMA cũng theo nguyên tắc "chỉ ghi nhận" — không tự động giải ngân qua hệ thống.

### 5.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-ORD-01 | 1 đơn hàng chỉ chứa sản phẩm của 1 Shop duy nhất. |
| BR-ORD-02 | Đơn PENDING quá 30 ngày chưa thanh toán → tự hủy + release kho. |
| BR-ORD-03 | Chỉ cho hủy đơn khi status ∈ {PENDING, CONFIRMED, PROCESSING} (trước khi bàn giao ĐVVC) — riêng Admin không bị giới hạn này, có thể hủy bất kỳ lúc nào, thực hiện ngay. |
| BR-ORD-04 | RMA chỉ được tạo trong vòng 7 ngày kể từ DELIVERED. |
| BR-ORD-05 | **Seller không có quyền tự duyệt/từ chối RMA trong hệ thống** — chỉ có 3 ngày để tự thương lượng ngoài hệ thống với Buyer. |
| BR-ORD-06 | Sau 3 ngày kể từ khi tạo RMA, nếu Buyer chưa thay đổi yêu cầu → **hệ thống tự động APPROVED** (cron job kiểm tra theo `requested_at + 3 days`). |
| BR-ORD-07 | Admin có quyền can thiệp (hủy đơn/hủy RMA) bất kỳ lúc nào, không cần đợi đủ 3 ngày, không cần ai duyệt. |
| BR-ORD-08 | Cộng lại `available_stock` **chỉ** khi Seller Confirm hàng đã về tay: Seller tự input số lượng + note loại hàng (`RETURNED` / `NEW`) — không auto cộng; không chặn theo DAMAGED. |
| BR-ORD-09 | Hệ thống không thực hiện giải ngân/hoàn tiền thật; chỉ xuất báo cáo hằng ngày phục vụ Admin/Kế toán đối chiếu thủ công. |
| BR-ORD-10 | Mọi thao tác Admin hủy đơn/hủy RMA thay khách đều được ghi Audit Log. |

### 5.4 State Machine Order (đề xuất) **[GIẢ ĐỊNH — cần khách xác nhận]**

```
PENDING → (thanh toán thành công / xác nhận COD) → CONFIRMED
CONFIRMED → PROCESSING → SHIPPED → DELIVERED
Bất kỳ trạng thái nào trước SHIPPED → CANCELLED (do Buyer/Seller/CSKH/Admin)
DELIVERED → (trong 7 ngày) → RMA_REQUESTED → (sau 3 ngày, tự động nếu Buyer không đổi ý) → RMA_APPROVED
RMA_REQUESTED → (Admin can thiệp bất kỳ lúc nào) → RMA_APPROVED / RMA_REJECTED (ngay lập tức, không cần đợi 3 ngày)
PENDING (quá 30 ngày không thanh toán) → EXPIRED/CANCELLED (tự động)
```

### 5.5 Database Schema (đề xuất)

```
orders
- id (PK), shop_id (FK), buyer_id (FK)
- status (ENUM: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, EXPIRED)
- payment_method (ENUM: COD, BANK_TRANSFER, CARD)
- payment_status (ENUM: UNPAID, PAID, FAILED)
- total_amount_usd, shipping_fee_usd
- shipping_address
- created_at, confirmed_at, delivered_at, cancelled_at

order_items
- order_id (FK), sku, quantity, unit_price_usd

order_cancellations
- order_id (FK), actor_id, actor_role, reason, created_at

rma_requests
- id (PK), order_id (FK), reason, evidence_urls
- status (ENUM: REQUESTED, APPROVED, REJECTED, STOCK_RETURNED)
- requested_at, auto_approve_at (requested_at + 3 days)   -- cron job xử lý auto-approve tại thời điểm này
- resolved_by (FK -> users, nullable nếu tự động)         -- NULL = hệ thống tự động duyệt, có giá trị = Admin can thiệp
- resolved_by_role (ENUM: SYSTEM_AUTO, ADMIN)
- resolved_at
- stock_return_confirmed_by (FK -> users)  -- Seller xác nhận nhận hàng về
- stock_return_qty (Int)                   -- số lượng Seller tự input khi Confirm
- stock_return_kind (ENUM: RETURNED, NEW)  -- hàng trả lại / hàng mới (Seller chọn)
- stock_return_note (text, nullable)       -- ghi chú thêm của Seller
- stock_return_confirmed_at
```

### 5.6 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/checkout` | Tạo đơn hàng từ giỏ hàng đã chọn |
| POST | `/api/v1/webhooks/payment` | Webhook xác nhận thanh toán từ cổng TT |
| POST | `/api/v1/webhooks/shipping` | Webhook cập nhật trạng thái vận chuyển từ ĐVVC |
| PUT | `/api/v1/orders/{id}/cancel` | Yêu cầu hủy đơn (Buyer/Seller/CSKH) |
| PUT | `/api/v1/admin/orders/{id}/force-cancel` | Admin tự hủy, không cần duyệt |
| POST | `/api/v1/orders/{id}/rma` | Buyer tạo yêu cầu RMA |
| PUT | `/api/v1/admin/rma/{id}/decision` | **Admin can thiệp bất kỳ lúc nào** (hủy/duyệt ngay, không cần đợi 3 ngày) — Seller không có endpoint duyệt/từ chối |
| PUT | `/api/v1/seller/rma/{id}/confirm-stock-return` | Seller Confirm hàng đã về: input qty + loại (`RETURNED`/`NEW`) + note → cộng kho |
| *(cron job nội bộ)* | — | Tự động chuyển RMA sang APPROVED khi `now >= auto_approve_at` và chưa có Admin can thiệp |
| GET | `/api/v1/admin/finance/daily-refund-report` | Báo cáo hằng ngày cho Admin/Kế toán đối chiếu hoàn tiền |

### 5.7 Test Cases tiêu biểu
- Checkout giỏ hàng có sản phẩm từ 2 Shop → chặn, yêu cầu tách đơn.
- Đơn PENDING 31 ngày không thanh toán → tự hủy, kho được trả lại.
- Buyer hủy đơn khi đã SHIPPED → chặn (phải qua RMA).
- Admin hủy đơn bất kỳ trạng thái nào → thành công, có ghi Audit Log.
- Buyer tạo RMA sau 8 ngày kể từ DELIVERED → chặn.
- Seller cố gọi API duyệt/từ chối RMA → 403 (Seller không có quyền này trong hệ thống, chỉ có 3 ngày tự thương lượng ngoài hệ thống).
- Tạo RMA, sau đúng 3 ngày Buyer không có phản hồi thay đổi → hệ thống tự động chuyển APPROVED (verify cron job chạy đúng thời điểm `auto_approve_at`).
- Admin can thiệp hủy RMA ở ngày thứ 1 (trước khi đủ 3 ngày) → thực hiện thành công ngay lập tức.
- Seller xác nhận nhận hàng trả về: tự input qty + note `RETURNED`/`NEW` → Confirm → `available_stock` tăng đúng số Seller nhập (verify không auto cộng trước Confirm).

### 5.8 Out of Scope
- Tự động hoàn tiền qua cổng thanh toán.
- Áp dụng khuyến mãi/voucher lúc checkout (chỉ chuẩn bị quyền hạn).
- Tính phí vận chuyển tự động qua API ĐVVC (chờ kết quả spike kỹ thuật).

---

## 6. MODULE: MARKETING & PROMOTION (KHUYẾN MÃI)

### 6.1 Mục tiêu
**Out of Scope cho giai đoạn triển khai hiện tại** — khách hàng xác nhận chưa cần chức năng khuyến mãi/voucher hoạt động thật.

### 6.2 Phạm vi giai đoạn này
- **Chỉ chuẩn bị sẵn cấu trúc phân quyền** (permission: `CREATE_PROMOTION`, `EDIT_PROMOTION`, `DELETE_PROMOTION`, `APPROVE_PROMOTION`) trong hệ thống RBAC, để khi triển khai đầy đủ sau này không cần sửa lại kiến trúc phân quyền.
- Không xây dựng UI, API nghiệp vụ, hay bảng dữ liệu chi tiết (loại khuyến mãi, ngân sách, điều kiện áp dụng...) ở giai đoạn này.

### 6.3 Ghi chú cho giai đoạn sau (khi triển khai)
Khi có yêu cầu nghiệp vụ cụ thể, cần làm rõ trước khi code:
- Danh sách loại khuyến mãi (giảm %, giảm tiền cố định, mua X tặng Y, free ship...).
- Giới hạn mức giảm tối đa, ngân sách, số lần sử dụng.
- Cách áp dụng lúc checkout (tự động hay nhập mã) và có cho chồng nhiều khuyến mãi không.
- Ngưỡng để khuyến mãi Seller tự động ACTIVE mà không cần Admin duyệt.

---

## 7. MODULE: CMS (BANNER) & MARKETING MATERIALS

### 7.1 Mục tiêu
Admin quản lý Banner quảng cáo trang chủ và kho tài liệu truyền thông (logo mẫu, hướng dẫn bán hàng...) cho Seller tải về.

### 7.2 Phạm vi

**Quản lý Banner**
- **Chỉ Admin** có quyền tạo/sửa/gỡ Banner (Seller không có quyền quản lý banner).
- Nhập: Hình ảnh, Title, URL đích, Mã ngôn ngữ (VI/EN/ZH-TW).
- Đăng thẳng lên (publish ngay), kèm Cache Invalidation (clear Redis cache của API Public) để hiển thị tức thì.
- **Không cần lên lịch tự động** (schedule) — Banner hiển thị liên tục cho đến khi Admin chủ động gỡ xuống hoặc ẩn.

**Tài liệu truyền thông (Marketing Materials)**
- **Admin là người duy nhất upload/tổ chức thư mục** tài liệu (giai đoạn này).
- Seller (đã xác thực quyền `VIEW_MKT_MAT`) duyệt thư mục, chọn tài liệu, tải xuống dưới dạng file .zip đóng gói.
- Khách hàng/Buyer bị chặn truy cập khu vực này (403 Forbidden).

### 7.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-CMS-01 | Chỉ role ADMIN/SUPER_ADMIN được thao tác Banner. |
| BR-CMS-02 | Banner mỗi ngôn ngữ (VI/EN/ZH-TW) quản lý nội dung riêng, không tự dịch. |
| BR-CMS-03 | Chỉ Seller/Admin (có quyền `VIEW_MKT_MAT`) mới tải được tài liệu truyền thông; Buyer bị chặn. |
| BR-CMS-04 | Publish Banner → clear cache Redis ngay để hiển thị real-time. |

### 7.4 Database Schema (đề xuất)

```
banners
- id (PK), image_url, target_url, locale (VI/EN/ZH-TW)
- title, is_active, display_order
- created_by, created_at, updated_at

marketing_materials
- id (PK), folder_path, file_name, file_url, uploaded_by, created_at
```

### 7.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/admin/banners` | Tạo banner |
| PUT | `/api/v1/admin/banners/{id}` | Sửa/gỡ/ẩn banner |
| GET | `/api/v1/banners?locale=VI` | Lấy banner public theo ngôn ngữ |
| POST | `/api/v1/admin/marketing-materials` | Admin upload tài liệu |
| GET | `/api/v1/marketing-materials` | Danh sách tài liệu (yêu cầu quyền `VIEW_MKT_MAT`) |
| GET | `/api/v1/marketing-materials/download?folder=X` | Tải zip |

### 7.6 Test Cases tiêu biểu
- Buyer cố truy cập API tài liệu truyền thông → 403.
- Admin gỡ Banner → API public không còn trả về banner đó ngay lập tức (verify cache đã clear).
- Seller cố tạo Banner → 403 (chỉ Admin mới có quyền).

### 7.7 Out of Scope
- Banner theo lịch tự động bật/tắt theo thời gian.
- Seller tự upload tài liệu vào kho chung.

---

## 8. MODULE: PAYMENT & FINANCE (THANH TOÁN & TÀI CHÍNH)

### 8.1 Mục tiêu
Quản lý chi trả (Payout) định kỳ cho Seller, cấu hình cổng thanh toán, tra cứu lịch sử giao dịch/xuất báo cáo, và tính chi phí nội bộ (Landing Cost).

### 8.2 Phạm vi

**Payout cho Seller**
- Kế toán/Admin tạo bảng kê chi trả theo chu kỳ **mỗi tuần và mỗi tháng** (Kế toán chọn khoảng thời gian phù hợp mỗi lần, không cố định cứng 1 loại chu kỳ).
- Doanh thu được tính = Tổng tiền đơn hàng **DELIVERED đã qua đủ 7 ngày** (đồng bộ với cơ chế "chốt doanh thu thực" ở Module 9) trừ Phí sàn (hoa hồng %) & Phí vận chuyển.
- **% hoa hồng sàn**: áp dụng theo mức đã thống nhất chung với khách hàng (business rule ngoài, chưa có trong tài liệu này), nhưng **Admin luôn có quyền override % riêng cho từng tài khoản Seller cụ thể**.
- Payout PENDING → Admin/Super Admin duyệt (APPROVE/REJECT, bắt buộc lý do khi REJECT).
- Sau khi APPROVE: hệ thống chỉ **ghi nhận "đã duyệt chi"** — việc chuyển tiền thật do Kế toán thực hiện thủ công bên ngoài hệ thống, sau đó quay lại bấm "Đánh dấu đã chuyển khoản" để hoàn tất phiếu (status = COMPLETED). **Không tích hợp API Ngân hàng thật.**

**Cấu hình cổng thanh toán**
- Super Admin nhập cấu hình (API Key, Secret Key, tên cổng) → mã hóa lưu trữ (Encrypt).
- Cơ chế đối soát chéo: Kế toán phải duyệt cấu hình mới do Super Admin nhập trước khi áp dụng (maker-checker, chống 1 người tự thao túng).
- Khách hàng (Buyer) **tự chọn cổng thanh toán** lúc checkout (COD hoặc 1 trong các cổng online đã cấu hình).

**Lịch sử giao dịch / Xuất báo cáo**
- Data Isolation theo role: Buyer chỉ xem đơn của mình; Seller chỉ xem giao dịch thuộc Shop mình; Admin/Kế toán xem toàn bộ.
- Xuất Excel/CSV, lưu S3, trả về URL tải.
- **[GIẢ ĐỊNH]** Giới hạn khoảng thời gian tối đa mỗi lần xuất báo cáo (ví dụ 12 tháng) để tránh quá tải hệ thống — cần khách xác nhận ngưỡng cụ thể.

**Landing Cost**
- Công thức: Giá gốc + Phí vận chuyển + Thuế + Phí đóng gói - Khuyến mãi.
- **Chỉ phục vụ nội bộ Seller/Admin tham khảo chi phí** — không hiển thị cho Buyer. Riêng phí vận chuyển mới là phần hiển thị công khai cho Buyer khi checkout.

### 8.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-FIN-01 | Doanh thu chỉ được đưa vào kỳ Payout sau khi qua đủ 7 ngày kể từ khi đơn DELIVERED (đồng bộ Module 9). |
| BR-FIN-02 | % hoa hồng mặc định áp dụng toàn sàn, nhưng Admin có thể override riêng theo từng Seller. |
| BR-FIN-03 | Payout REJECT bắt buộc nhập lý do. |
| BR-FIN-04 | Hệ thống không tự động chuyển tiền thật; "COMPLETED" chỉ được đánh dấu thủ công sau khi Kế toán xác nhận đã chuyển khoản ngoài hệ thống. |
| BR-FIN-05 | Cấu hình cổng thanh toán mới cần Kế toán duyệt (đối soát chéo) trước khi áp dụng toàn sàn. |
| BR-FIN-06 | Nếu đơn hàng bị hủy/hoàn sau khi đã tính vào doanh thu 7 ngày, **Admin tự cân đối bằng tay** — hệ thống chưa cần cơ chế tự động điều chỉnh lại. |

### 8.4 Database Schema (đề xuất)

```
payout_batches
- id (PK), shop_id (FK), period_start, period_end
- gross_amount_usd, commission_amount_usd, shipping_fee_amount_usd, net_amount_usd
- status (ENUM: PENDING, APPROVED, REJECTED, COMPLETED)
- rejection_reason, approved_by, completed_by, completed_at

shop_commission_overrides
- shop_id (FK, unique), commission_rate, updated_by, updated_at

payment_gateway_configs
- id, gateway_name, encrypted_api_key, encrypted_secret_key
- status (ENUM: PENDING_REVIEW, ACTIVE, REJECTED)
- created_by (Super Admin), reviewed_by (Kế toán)
```

### 8.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/finance/payout-batches` | Kế toán tạo bảng kê chi trả |
| PUT | `/api/v1/finance/payout-batches/{id}/approve` | Duyệt |
| PUT | `/api/v1/finance/payout-batches/{id}/reject` | Từ chối |
| PUT | `/api/v1/finance/payout-batches/{id}/mark-completed` | Đánh dấu đã chuyển khoản thủ công |
| POST | `/api/v1/admin/payment-gateway-configs` | Super Admin nhập cấu hình |
| PUT | `/api/v1/finance/payment-gateway-configs/{id}/review` | Kế toán duyệt cấu hình |
| GET | `/api/v1/transactions` | Lịch sử giao dịch (data isolation theo role) |
| POST | `/api/v1/transactions/export` | Xuất báo cáo Excel/CSV |
| GET | `/api/v1/seller/landing-cost?product_id=` | Tính Landing Cost nội bộ |

### 8.6 Test Cases tiêu biểu
- Payout batch tính doanh thu bao gồm đơn DELIVERED mới 3 ngày → phải bị loại trừ (chưa đủ 7 ngày).
- Admin override % hoa hồng riêng cho 1 Seller → Payout batch kế tiếp của Seller đó áp dụng đúng % mới.
- Seller cố xem lịch sử giao dịch của Shop khác → 403 (data isolation).
- Cấu hình cổng thanh toán mới do Super Admin nhập, Kế toán chưa duyệt → chưa được dùng để xử lý giao dịch thật.

### 8.7 Out of Scope
- Tích hợp thật với API chuyển khoản ngân hàng.
- Tự động đối soát khi đơn bị hủy/hoàn sau khi đã Payout.

---

## 9. MODULE: MLM & E-WALLET (HOA HỒNG & VÍ ĐIỂM)

### 9.1 Mục tiêu
Ghi nhận hoa hồng giới thiệu đa tầng, quản lý Ví điểm thưởng nội bộ, cho phép chuyển điểm P2P và rút tiền — với bảo mật đa lớp.

> **✅ [ĐÃ CHỐT]** Khách hàng xác nhận: **Chuyển điểm P2P và Rút tiền đều phải làm đầy đủ ngay trong giai đoạn này** (không hoãn lại), cùng với chức năng ghi nhận hoa hồng. Đây là thay đổi so với bản nháp trước — trước đó có cân nhắc hoãn 2 tính năng này lại vì `available_balance`/`frozen_balance` chưa được định nghĩa rõ, nhưng khách hàng đã xác nhận cần làm ngay, nên plan này giữ nguyên định nghĩa 2 cột số dư này (mục "Ví điện tử" bên dưới) làm nền tảng triển khai.

### 9.2 Phạm vi

**Link giới thiệu & Hoa hồng**
- **Mọi role đều có quyền sở hữu link giới thiệu (Affiliate link)** — không giới hạn riêng Seller.
- 1 điểm thưởng = 0.99999 USD (quy đổi cố định).
- Khi có đơn hàng phát sinh qua link giới thiệu: hệ thống **tạm ghi nhận** % điểm được hưởng ngay (trạng thái tạm/chưa chốt).
- % hoa hồng tính trên **giá gốc sản phẩm** (chưa có khuyến mãi ở giai đoạn này). Có tính đa tầng (nhiều F-level) — **✅ chờ khảo sát thêm**; Sprint 6 vẫn làm P2P/rút tiền + scaffold `commission_ledgers`, % thật cấu hình sau khi có công thức.
- **Thời điểm chốt "doanh thu thực"**: sau **7 ngày kể từ khi đơn hàng được xác nhận** (COD: tính từ lúc đơn CONFIRMED; Thẻ/Chuyển khoản: tính từ lúc thanh toán thành công), vào lúc 23:59 ngày thứ 7 → điểm tạm ghi nhận được chuyển thành điểm thực, cộng vào Ví.
- Nếu đơn bị hủy/hoàn **trong vòng 7 ngày đó** → điểm tạm ghi nhận không được chốt thành thực (tự động loại trừ khỏi lần chốt).
- Nếu đơn bị hủy/hoàn **sau khi đã chốt thành điểm thực** → **Admin tự tay cân bằng lại số dư** — chưa cần cơ chế tự động thu hồi.
- Data Isolation (BR_02): người dùng chỉ xem được tuyến dưới trực tiếp của mình, không xem được ID/thông tin của tuyến ngoài phạm vi được phép.

**Ví điện tử (available_balance / frozen_balance)**
- `available_balance`: số dư khả dụng, dùng để chuyển điểm P2P hoặc tạo lệnh rút tiền.
- `frozen_balance`: số dư đang bị tạm giữ khi có lệnh rút tiền đang chờ duyệt; tự động hoàn lại `available_balance` nếu lệnh bị từ chối.
- **Không giới hạn hạn mức** tối thiểu/tối đa mỗi lần chuyển điểm hoặc rút tiền, cũng như không giới hạn số lần/ngày.

**Chuyển điểm P2P — ✅ [ĐÃ CHỐT]**
- Người gửi nhập ID/SĐT người nhận + số điểm cần chuyển.
- **Xác thực 2 bước bắt buộc**: (1) nhập lại **mật khẩu đăng nhập tài khoản**, (2) nhập **mã OTP gửi qua Email**.
- Khóa số dư người gửi (SELECT FOR UPDATE), kiểm tra đủ số dư → trừ người gửi, cộng người nhận, ghi 2 dòng vào `wallet_transactions` (1 IN, 1 OUT) trong cùng 1 transaction.
- Chặn tự chuyển cho chính mình; áp dụng idempotency-key để tránh bấm gửi 2 lần bị trừ đúp.
- **Không dùng PIN cấp 2** cho P2P.

**Rút tiền — ✅ [ĐÃ CHỐT]**
- Người dùng nhập số điểm cần rút + thông tin ngân hàng → tạo lệnh `payout_requests` (status PENDING), trừ `available_balance`, cộng `frozen_balance`. **Không yêu cầu PIN cấp 2.**
- Hệ thống hiển thị danh sách các giao dịch rút tiền cần xử lý cho Admin/Kế toán.
- Admin/Kế toán duyệt (APPROVE/REJECT):
  - REJECT → hoàn `frozen_balance` về `available_balance`.
  - APPROVE → status `APPROVED`, **hệ thống dừng** — không gọi API Ngân hàng ("chỉ thể hiện, không quản lý tiền"). Kế toán công ty chi tiền thật bên ngoài.
  - Sau khi chi xong, Admin/Kế toán **xác nhận "Đã chi tiền"** → trừ dứt `frozen_balance`, status = `COMPLETED`.
- **Không có maker-checker 2 người** cho bước chi trả ngoài hệ thống.

**PIN cấp 2 — ✅ [ĐÃ CHỐT: không làm giai đoạn này]**
- P2P dùng Mật khẩu + OTP Email; Rút tiền không dùng PIN. **Không triển khai** module `user_pins` / Quên PIN / khóa sai PIN ở giai đoạn hiện tại.

### 9.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-WALLET-01 | 1 điểm = 0.99999 USD (tỷ lệ quy đổi cố định, có thể cấu hình bởi Super Admin). |
| BR-WALLET-02 | Hoa hồng chỉ chốt thành điểm thực sau 7 ngày kể từ khi đơn được xác nhận/thanh toán thành công, vào 23:59 ngày thứ 7. |
| BR-WALLET-03 | Đơn bị hủy/hoàn trong 7 ngày chờ chốt → tự động loại điểm tạm khỏi lần chốt; nếu đã chốt rồi mới hủy → Admin tự cân đối tay. |
| BR-WALLET-04 | Không giới hạn hạn mức/tần suất chuyển điểm P2P và rút tiền. |
| BR-WALLET-05 | Rút tiền: Admin duyệt → Kế toán chi ngoài hệ thống → xác nhận "đã chi tiền"; không tích hợp ngân hàng; không PIN. |
| BR-WALLET-06 | Data Isolation: chỉ xem được thông tin tuyến dưới trực tiếp, không xem xuyên tầng ngoài phạm vi cho phép. |
| BR-WALLET-07 | Mọi giao dịch ví (chuyển điểm, rút tiền, duyệt) đều ghi Audit Log (hành động nhạy cảm). |
| BR-WALLET-08 | Chặn chuyển điểm cho chính mình. |

### 9.4 Database Schema (đề xuất)

```
wallets
- user_id (FK, unique), available_balance, frozen_balance, updated_at

wallet_transactions
- id, wallet_user_id, type (ENUM: COMMISSION_PENDING, COMMISSION_CONFIRMED, P2P_IN, P2P_OUT, WITHDRAW_LOCK, WITHDRAW_COMPLETED, WITHDRAW_REFUND)
- amount, related_order_id, related_transfer_id, created_at

commission_ledgers                 -- theo dõi hoa hồng tạm/thực theo từng đơn
- id, order_id, beneficiary_user_id, level (F1/F2...), amount_points
- status (ENUM: PENDING_CONFIRM, CONFIRMED, VOIDED)
- pending_since, confirm_due_at (pending_since + 7 days), confirmed_at

payout_requests (ví MLM - khác payout_batches của Module 8)
- id, user_id, amount_points, bank_info (JSON)
- status (ENUM: PENDING, APPROVED, REJECTED, COMPLETED)
- approved_by, completed_by, completed_at

-- user_pins: OUT OF SCOPE giai đoạn này (không dùng PIN)
```

### 9.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/v1/wallet/affiliate-link` | Lấy link giới thiệu cá nhân |
| GET | `/api/v1/wallet/network-tree` | Xem tuyến dưới (data isolation) |
| GET | `/api/v1/wallet/commission-stats` | Thống kê hoa hồng |
| GET | `/api/v1/wallet/balance` | Xem số dư |
| POST | `/api/v1/wallet/p2p-transfer` | Chuyển điểm (mật khẩu + OTP Email) |
| POST | `/api/v1/wallet/withdraw` | Tạo lệnh rút tiền |
| PUT | `/api/v1/finance/withdraw-requests/{id}/decision` | Admin/Kế toán duyệt APPROVE/REJECT |
| PUT | `/api/v1/finance/withdraw-requests/{id}/mark-completed` | Xác nhận "đã chi tiền" |

### 9.6 Test Cases tiêu biểu
- Đơn hàng DELIVERED, sau 7 ngày → điểm hoa hồng tự động chuyển từ PENDING_CONFIRM sang CONFIRMED đúng thời điểm 23:59.
- Đơn bị hủy ở ngày thứ 5 (trước khi chốt) → điểm tạm bị loại, không cộng vào ví.
- Chuyển điểm cho chính mình → chặn.
- Nhập sai mật khẩu / OTP khi P2P → chặn, không trừ điểm.
- Rút tiền bị REJECT → `frozen_balance` hoàn lại `available_balance` chính xác.
- Rút tiền APPROVED, Kế toán đánh dấu COMPLETED → `frozen_balance` trừ dứt điểm, không ảnh hưởng `available_balance`.

### 9.7 Out of Scope
- Tích hợp API chuyển tiền thật qua Ngân hàng.
- Module PIN cấp 2 / Quên PIN / khóa ví do sai PIN.
- Cơ chế tự động thu hồi điểm khi đơn hủy sau khi đã chốt hoa hồng.
- Công thức % hoa hồng từng F-level chi tiết — **chờ khảo sát nghiệp vụ**; giai đoạn này có thể scaffold ledger với % placeholder có cấu hình.

---

## 10. MODULE: SYSTEM ADMINISTRATION (QUẢN TRỊ NỘI BỘ)

### 10.1 Mục tiêu
Quản lý tài khoản nhân sự nội bộ & phân quyền chi tiết (RBAC), nhật ký hệ thống, sao lưu dữ liệu, và xử lý yêu cầu xóa dữ liệu cá nhân theo compliance.

### 10.2 Phạm vi

**Tạo tài khoản nhân sự & Phân quyền (RBAC)**
- Admin/Super Admin tạo tài khoản nhân sự, gán `permission_codes` chi tiết (không chỉ role cố định).
- Chặn leo quyền: Admin không được tự gán quyền ngang/cao hơn Super Admin.
- Admin tạo tài khoản mới → status = PENDING, **cần Super Admin duyệt** trước khi ACTIVE (bổ sung so với flow gốc, khắc phục khoảng trống đã phát hiện).
- Super Admin tự tạo tài khoản → cấp quyền chính thức ngay, không cần ai duyệt thêm.
- Đổi quyền của 1 tài khoản đang hoạt động → Force Logout ngay lập tức (dùng chung cơ chế Redis Blacklist của Module 1).

**Nhật ký hệ thống (Audit Log)**
- Ghi log các **hành động nhạy cảm**: duyệt/từ chối (Shop, Product, Inventory, RMA, Payout, Withdraw), đổi quyền, khóa/mở khóa/xóa tài khoản, giao dịch ví.
- Tầng DB user ghi log chỉ có quyền INSERT/SELECT — khóa hoàn toàn UPDATE/DELETE để đảm bảo log không thể bị sửa/xóa dù có lỗ hổng ứng dụng.
- Bộ lọc tra cứu: thời gian, tên tài khoản, IP, hành động.

**Sao lưu dữ liệu (Backup)**
- Super Admin khởi tạo backup FULL hoặc PARTIAL, đẩy vào Message Queue xử lý bất đồng bộ (trả về 202 Accepted ngay).
- Worker chạy ngầm dump Database → .sql/.zip.
- **Nếu backup thất bại giữa chừng → gửi thông báo ngay cho Super Admin** (bổ sung theo yêu cầu khách hàng), cập nhật trạng thái FAILED.

**Xóa dữ liệu cá nhân (Anonymization)**
- **Không có form tự yêu cầu trong app** — khách hàng phải liên hệ Admin thủ công (qua kênh hỗ trợ ngoài hệ thống).
- Admin xác minh yêu cầu hợp lệ → chuyển lệnh lên Super Admin thực thi.
- Trước khi thực thi: kiểm tra tài khoản có đơn hàng/Payout/lệnh rút tiền **chưa hoàn tất** không — nếu còn, **chặn thực hiện Anonymize** cho tới khi các nghiệp vụ đó kết thúc.
- Anonymize (đổi tên = "Deleted User", email/phone = placeholder) áp dụng cho `Users`, `Addresses`, và **các bảng khác chứa PII** (review, tin nhắn CSKH — nếu có, cần rà soát đầy đủ khi triển khai chi tiết).
- Dùng DB Transaction, tuyệt đối không chạy lệnh DELETE vật lý để giữ toàn vẹn khóa ngoại.

### 10.3 Business Rules

| Mã | Quy tắc |
|---|---|
| BR-SYS-01 | Admin không được tự gán quyền ngang/cao hơn Super Admin (chặn leo quyền). |
| BR-SYS-02 | Tài khoản nhân sự do Admin tạo → cần Super Admin duyệt trước khi ACTIVE. |
| BR-SYS-03 | Đổi quyền tài khoản đang hoạt động → Force Logout ngay lập tức. |
| BR-SYS-04 | DB user phục vụ Audit Log chỉ có quyền INSERT/SELECT, không có UPDATE/DELETE. |
| BR-SYS-05 | Backup thất bại → gửi thông báo ngay cho Super Admin, đánh dấu FAILED. |
| BR-SYS-06 | Anonymize bị chặn nếu tài khoản còn nghiệp vụ tài chính/đơn hàng chưa hoàn tất. |
| BR-SYS-07 | Tuyệt đối không chạy lệnh DELETE vật lý khi Anonymize — chỉ UPDATE ẩn danh dữ liệu. |

### 10.4 Database Schema (đề xuất)

```
permissions
- code (PK, e.g. VIEW_MKT_MAT, ADD_EDIT_INVENTORY, APPROVE_SHOP...)
- description

user_permissions
- user_id (FK), permission_code (FK)
- PRIMARY KEY (user_id, permission_code)

audit_logs                    -- DB user: INSERT/SELECT only
- id, actor_id, action_type, target_type, target_id
- ip_address, old_value (JSON), new_value (JSON), created_at

backup_jobs
- id, backup_type (FULL/PARTIAL), status (RUNNING/COMPLETED/FAILED)
- file_url, started_by, started_at, completed_at, error_message

anonymization_requests
- id, target_user_id, requested_by (Admin), approved_by (Super Admin)
- status (ENUM: PENDING_CHECK, BLOCKED, COMPLETED)
- blocked_reason, completed_at
```

> **Lưu ý kiến trúc quan trọng:** `user_permissions` (RBAC chi tiết) ở Module 10 cần được dùng làm **nguồn xác thực quyền duy nhất** cho toàn bộ 9 module còn lại (thay vì check role cố định rải rác từng nơi như flow gốc từng vẽ). Ví dụ quyền `VIEW_MKT_MAT` (Module 7), `ADD_EDIT_INVENTORY` (Module 4), `APPROVE_SHOP` (Module 2) đều nên nằm trong bảng `permissions` này để nhất quán toàn hệ thống.

### 10.5 API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/api/v1/admin/staff-accounts` | Tạo tài khoản nhân sự + gán quyền |
| PUT | `/api/v1/super-admin/staff-accounts/{id}/approve` | Super Admin duyệt tài khoản do Admin tạo |
| GET | `/api/v1/super-admin/audit-logs` | Tra cứu nhật ký hệ thống |
| POST | `/api/v1/super-admin/backups` | Khởi tạo backup |
| GET | `/api/v1/super-admin/backups/{id}` | Trạng thái backup |
| POST | `/api/v1/super-admin/anonymization-requests` | Tạo yêu cầu ẩn danh dữ liệu |
| PUT | `/api/v1/super-admin/anonymization-requests/{id}/execute` | Thực thi ẩn danh |

### 10.6 Test Cases tiêu biểu
- Admin cố gán quyền SUPER_ADMIN cho tài khoản mới → chặn, 403.
- Tài khoản do Admin tạo ở PENDING, chưa Super Admin duyệt, cố đăng nhập → chặn.
- Đổi quyền 1 nhân sự đang online → phiên hiện tại bị logout ngay request tiếp theo.
- Anonymize 1 tài khoản Seller còn Payout PENDING → bị chặn, báo lý do rõ ràng.
- DB user của audit_logs cố chạy UPDATE → bị từ chối ở tầng database.
- Backup FULL thất bại giữa chừng (giả lập hết dung lượng) → Super Admin nhận thông báo FAILED.

### 10.7 Out of Scope
- Tự động archive/xóa Audit Log theo thời gian lưu trữ (retention policy) — cần bổ sung sau nếu có yêu cầu.
- Cho phép khách hàng tự yêu cầu xóa dữ liệu qua form trong app.

---

## 11. PHỤ LỤC A — ĐA NGÔN NGỮ & ĐA TIỀN TỆ (CHI TIẾT KỸ THUẬT)

### 11.1 Đa ngôn ngữ (I18n)
| Locale | Ngôn ngữ | Thị trường |
|---|---|---|
| `vi` | Tiếng Việt | Việt Nam |
| `en` | Tiếng Anh | Singapore, Malaysia, quốc tế |
| `zh-TW` | Tiếng Trung phồn thể | Đài Loan |

- Mọi bảng có nội dung do người dùng nhập (tên Shop, tên sản phẩm, mô tả, lý do từ chối, Banner...) cần bảng `_translations` riêng hoặc cột JSON dạng `{"vi": "...", "en": "...", "zh-TW": "..."}`.
- **[GIẢ ĐỊNH — cần khách xác nhận]**: Malaysia có cần thêm riêng tiếng Mã Lai (Bahasa Malaysia) hay dùng chung tiếng Anh là đủ? Singapore tương tự — giả định dùng chung tiếng Anh cho cả 2 thị trường.

### 11.2 Đa tiền tệ
- **USD là đơn vị gốc**, lưu trữ & tính toán nội bộ toàn hệ thống (giá sản phẩm, doanh thu, Payout, Ví điểm).
- Tiền tệ địa phương (VND, TWD, SGD, MYR) chỉ dùng ở tầng hiển thị.
- **[GIẢ ĐỊNH — cần khách xác nhận, chưa có câu trả lời chính thức]**:
  - Nguồn tỷ giá: dùng API tỷ giá bên thứ 3, cập nhật 1 lần/ngày.
  - Thời điểm chốt tỷ giá khi thanh toán: lấy tỷ giá tại **thời điểm thanh toán thành công** (không tính theo lúc xem sản phẩm).
  - Payout cho Seller: trả bằng USD (đồng tiền gốc), Seller tự quy đổi khi rút ra ngân hàng.

---

## 12. PHỤ LỤC B — DANH SÁCH CÂU HỎI CÒN TREO (CẬP NHẬT SAU VÒNG XÁC NHẬN MỚI NHẤT)

### Đã chốt ở vòng trao đổi này (không còn treo)
- ✅ Kho: Seller/Admin tự tạo phiếu → tự động duyệt ngay; chỉ phiếu do NV Kho tạo mới cần Seller duyệt.
- ✅ RMA: Seller không có quyền duyệt/từ chối, chỉ có 3 ngày tự thương lượng; hệ thống tự động APPROVED sau 3 ngày nếu Buyer không đổi ý; Admin can thiệp ngay lập tức bất kỳ lúc nào.
- ✅ RMA cộng kho: **chỉ khi hàng về tay Seller** — Seller tự input qty + note (`RETURNED` / `NEW`) rồi Confirm; không rule DAMAGED tự chặn cộng kho.
- ✅ Xóa tài khoản: Soft-delete, giữ dữ liệu vĩnh viễn.
- ✅ SKU: unique theo `(shop_id, sku)`.
- ✅ MLM & Wallet: **P2P + Rút tiền làm đầy đủ** giai đoạn này (không chỉ ghi nhận điểm).
- ✅ P2P: xác minh **mật khẩu + OTP Email**.
- ✅ Rút tiền: tạo lệnh → Admin duyệt → Kế toán chi ngoài → xác nhận **"đã chi tiền"**; hệ thống chỉ ghi nhận.
- ✅ PIN cấp 2: **không làm** giai đoạn này.
- ✅ Thông báo phiếu kho: chỉ in-app, không email/SMS.

### Còn treo — cần khách xác nhận thêm

| # | Module | Câu hỏi |
|---|---|---|
| 3 | Order | State machine đầy đủ của Order (mục 5.4) — đặc biệt COD → CONFIRMED khi nào. |
| 4 | Finance/Wallet | % hoa hồng đa tầng MLM — công thức từng F-level (**chờ khảo sát**). Sprint 6 scaffold được; chốt % trước khi tính hoa hồng thật. |
| 5 | Finance | Giới hạn khoảng thời gian tối đa khi xuất báo cáo giao dịch (Excel/CSV). |
| 7 | I18n | Singapore/Malaysia dùng chung tiếng Anh, hay thêm tiếng Mã Lai? |
| 8 | Đa tiền tệ | Nguồn tỷ giá và thời điểm chốt khi thanh toán (mục 11.2). |
| 9 | Đơn hàng | Spike API phí vận chuyển ĐVVC. |
| 10 | Toàn hệ thống | Policy mật khẩu (BR-AUTH-02) và TTL cleanup PENDING_VERIFY (BR-AUTH-03). |

---

## 13. LỘ TRÌNH TRIỂN KHAI ĐỀ XUẤT (SPRINT PLANNING SƠ BỘ)

| Giai đoạn | Module | Lý do ưu tiên |
|---|---|---|
| Sprint 1 | Module 1 (Authen) + Module 10 (RBAC nền tảng) | Nền tảng bắt buộc cho mọi module khác |
| Sprint 2 | Module 2 (Shop) + Module 3 (Product) | Seller cần có Shop + Sản phẩm trước khi bán được hàng |
| Sprint 3 | Module 4 (Inventory) | Order phụ thuộc vào cơ chế khóa tồn kho của Inventory |
| Sprint 4 | Module 5 (Order — Đặt hàng, Hủy) | Lõi nghiệp vụ chính của sàn |
| Sprint 5 | Module 5 (RMA) + Module 8 (Finance cơ bản: Payout, Cấu hình TT) | Hoàn thiện vòng đời đơn hàng + dòng tiền cho Seller |
| Sprint 6 | Module 9 (MLM & Wallet) | Phụ thuộc Order đã ổn định (cần dữ liệu đơn DELIVERED để tính hoa hồng) |
| Sprint 7 | Module 7 (CMS/Banner) + Module 10 (Audit Log, Backup, Anonymization) | Tính năng hỗ trợ vận hành, không chặn đường găng |
| Sau MVP | Module 6 (Marketing/Khuyến mãi) | Out of Scope — triển khai khi có yêu cầu cụ thể |

---

*Hết tài liệu. Mọi mục đánh dấu [GIẢ ĐỊNH] cần được khách hàng xác nhận lại trước khi bắt đầu code chi tiết từng module.*
