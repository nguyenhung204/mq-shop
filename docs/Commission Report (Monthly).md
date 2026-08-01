# Commission Report (Monthly)

## Mục đích

Commission Report là màn hình dành cho **Super Admin** để theo dõi, kiểm toán (Audit) và đối soát toàn bộ các khoản hoa hồng đã được tính trong một kỳ (tháng).

Màn hình giúp trả lời các câu hỏi:

- Tổng doanh số tháng là bao nhiêu?
- Hệ thống đã chi bao nhiêu tiền hoa hồng?
- Ai nhận nhiều nhất?
- Vì sao người đó nhận được khoản tiền đó?
- Có Tier nào của Global Fund không có người nhận?
- Công ty giữ lại bao nhiêu tiền?
- Có batch nào chạy lỗi hoặc bỏ sót dữ liệu hay không?

---

# API

```
GET /admin/mlm/commissions/report?yearMonth=2026-07
```

Nếu không truyền `yearMonth`:

- Mặc định lấy tháng trước (UTC).

---

# Dashboard Summary

Đây là phần đầu tiên của màn hình.

Hiển thị các chỉ số tổng quan của tháng.

| Thông tin | Ý nghĩa |
|-----------|----------|
| Year Month | Tháng đang xem |
| GMV | Tổng doanh số của các đơn DELIVERED |
| Delivered Orders | Tổng số đơn hàng hoàn thành |
| Global Fund Percent | % doanh thu được trích vào Global Fund |
| Global Pool / Tier | Giá trị quỹ của mỗi Tier |
| Grand Total Payout | Tổng số tiền công ty đã chi trả |

Ví dụ:

```
Tháng: 2026-07

GMV                     1.000.000
Delivered Orders              312
Global Fund                  2%
Global Pool / Tier      20.000
Grand Total Payout      95.000
```

---

# Các loại hoa hồng

Dashboard hiển thị 4 card chính.

```
Referral Commission
45 người nhận
31.500

[Xem chi tiết]

-----------------------------

Team Commission
12 người nhận
28.000

[Xem chi tiết]

-----------------------------

Global Profit Sharing
8 người nhận
28.000

[Xem chi tiết]

-----------------------------

Loyalty Reward
2 người nhận
56.000

[Xem chi tiết]
```

---

# Referral Commission

## Danh sách

Click "Referral Commission".

Hiển thị:

| Người nhận | Rank | Tổng nhận |
|------------|------|----------:|
| Nguyễn Văn A | Đại lý | 5.200 |
| Trần Văn B | Giám đốc | 3.800 |
| ... | ... | ... |

Danh sách mặc định sort theo:

```
totalPayout DESC
```

để người nhận nhiều nhất luôn ở trên.

---

## Chi tiết người nhận

Click vào một User.

Hiển thị toàn bộ Referral Commission của người đó.

| Người được giới thiệu | Order | Order Total | Referral % | Commission | Delivered At |
|-----------------------|-------|------------:|-----------:|-----------:|--------------|
| Nguyễn B | ORD001 | 10.000 | 7% |700|2026-07-02|
| Nguyễn C | ORD010 | 20.000 |7%|1400|2026-07-08|
| Nguyễn D | ORD050 |30.000|7%|2100|2026-07-21|

Ngoài ra nên hiển thị:

```
Buyer
↓

Referrer
```

Ví dụ

```
Buyer

Nguyễn Văn B

↓

Referrer

Nguyễn Văn A
```

Admin có thể click vào Order để mở Order Detail.

Mục đích:

- Kiểm tra Buyer.
- Kiểm tra Order.
- Kiểm tra Delivered Date.
- Verify Referral Commission.

---

# Team Commission

Đây là màn hình cần phục vụ Audit nhiều nhất.

## Danh sách

| Người nhận | Rank | Tổng nhận |
|------------|------|----------:|
| Nguyễn A | Hoàng quan |12.000|
| Trần B | Tổng tài |8.000|

---

## Chi tiết

Click User.

Hiển thị toàn bộ Team Commission.

| Buyer | Order | Order Total | Rank | Team % | Max Below | Paid % | Commission |
|--------|-------|------------:|------|-------:|----------:|-------:|-----------:|

Ví dụ

| Buyer | Order | Amount | Team % | Max Below | Paid % | Commission |
|--------|-------|-------:|--------:|----------:|-------:|-----------:|
| Nguyễn C | ORD001 |100.000|10|8|2|2.000|
| Nguyễn D | ORD010 |300.000|10|6|4|12.000|

Ý nghĩa:

- Team % là quyền lợi của Rank hiện tại.
- Max Below là % cao nhất mà tuyến dưới đã nhận.
- Paid % = Team % - Max Below.

Điều này giúp Admin kiểm tra Differential Commission có chính xác hay không.

---

## Hiển thị cây MLM (Khuyến nghị)

Có thể bổ sung phần Tree View.

Ví dụ

```
Buyer

↓

Đại lý (2%)

↓

Giám đốc (6%)

↓

Hoàng quan (10%)
```

Highlight:

```
Đại lý

2%

Giám đốc

4%

Hoàng quan

4%
```

Admin nhìn vào sẽ hiểu ngay:

- Ai nhận trước.
- Ai ăn phần chênh lệch.
- Vì sao người trên không nhận.

---

# Global Profit Sharing

## Danh sách Tier

| Tier | Pool | Eligible | Paid | Company Kept | Status |
|------|------:|---------:|-----:|-------------:|--------|
| Tier 5 |20.000|10|20.000|0|PAID|
| Tier 6 |20.000|0|0|20.000|COMPANY_KEPT|
| Tier 7 |20.000|5|20.000|0|PAID|

Status gồm:

- PAID
- COMPANY_KEPT
- NOT_RUN

---

## Chi tiết Tier

Click Tier.

Hiển thị:

| User | Rank | Amount |
|------|------|--------:|
| Nguyễn A | Giám đốc |2.000|
| Nguyễn B | Tổng tài |2.000|

Admin biết:

Pool:

```
20.000
```

Eligible:

```
10
```

Mỗi người:

```
2.000
```

Nếu Tier không có ai:

```
Pool

20.000

Eligible

0

Company Kept

20.000
```

Admin hiểu đây là đúng chính sách.

---

# Loyalty Reward

## Danh sách

| User | Reward |
|------|--------:|
| Nguyễn A |28.000|
| Nguyễn B |28.000|

---

## Chi tiết

Click User.

Hiển thị lịch sử 12 tháng.

| Month | PV | Status |
|--------|---:|--------|
|2025-08|2500|✓|
|2025-09|2300|✓|
|...|||
|2026-07|2800|✓|

Nếu có tháng không đạt:

| Month | PV | Status |
|--------|---:|--------|
|2026-04|1800|RESET|

Admin có thể biết vì sao User không đủ điều kiện nhận thưởng.

---

# Summary

Cuối màn hình nên có phần đối soát.

```
GMV

1.000.000

↓

Referral

31.500

↓

Team

28.000

↓

Global

28.000

↓

Loyalty

56.000

↓

Company Kept

20.000

↓

Grand Total Payout

95.000
```

Giúp Admin dễ dàng:

- Kiểm tra tổng chi.
- Kiểm tra Company Kept.
- Kiểm tra Grand Total.

---

# KPI nên hiển thị

Ngoài dữ liệu hiện tại nên bổ sung:

| KPI | Ý nghĩa |
|------|----------|
| Commission / GMV (%) | Tỷ lệ hoa hồng trên doanh số |
| Total Commission Entries | Tổng số bản ghi hoa hồng |
| Total Recipients | Tổng số người nhận thưởng |
| Company Kept Total | Tổng tiền công ty giữ lại |
| Failed Entries | Số bản ghi tính lỗi (nếu có) |
| Batch Status | COMPLETED / FAILED / RUNNING |
| Generated At | Thời điểm tạo báo cáo |
| Generated By | Batch Job tạo báo cáo |

---

# Mục tiêu của Commission Report

Commission Report không chỉ là màn hình thống kê mà còn là màn hình Audit.

Thông qua màn hình này, Super Admin có thể:

- Theo dõi tổng doanh số của tháng.
- Theo dõi tổng số tiền công ty đã chi hoa hồng.
- Kiểm tra chi tiết từng khoản hoa hồng.
- Biết chính xác mỗi User nhận tiền từ đơn hàng nào.
- Kiểm tra Differential Commission có được tính đúng hay không.
- Kiểm tra Global Fund đã chia đúng cho từng Tier.
- Kiểm tra Tier nào không có người nhận và số tiền công ty giữ lại.
- Kiểm tra lịch sử Loyalty Reward của từng User.
- Đối soát toàn bộ số tiền đã chi với chính sách hoa hồng của hệ thống.