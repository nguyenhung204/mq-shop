# Mô tả chức năng — Cây minh họa quy tắc thăng hạng

## 1. Mục đích

Xây dựng một **cây phân cấp minh họa quy tắc thăng hạng MLM** trên Frontend.

Cây **không sử dụng dữ liệu user thực tế**. Mỗi node trên cây là một **mock user được Frontend tự động sinh ra**, nhằm trực quan hóa số lượng F1 và rank yêu cầu để một user đạt được rank tiếp theo.

Nguồn dữ liệu duy nhất gồm:

- **Danh sách Rank**
- **Danh sách Quy tắc thăng hạng**

Frontend sẽ dựa vào hai nguồn dữ liệu này để tự động xây dựng cây.

---

## 2. Nguyên tắc sinh cây

Mỗi node đại diện cho một **mock user** ở một rank cụ thể.

Ví dụ rule:

```text
Rank 9 → Rank 10
F1 đạt rank ≥ Rank 9
Số F1 cần = 2
```

thì khi một node có rank 10, Frontend sẽ tự động sinh:

```text
                 Mock User
                  Rank 10
                 /        \
                /          \
          Mock User      Mock User
             Rank 9         Rank 9
```

Mỗi node Rank 9 tiếp tục được xử lý theo rule:

```text
Rank 8 → Rank 9
F1 đạt rank ≥ Rank 8
Số F1 cần = 3
```

Kết quả:

```text
                    Rank 10
                   /       \
                Rank 9    Rank 9
               /  |  \    /  |  \
             R8  R8  R8  R8  R8  R8
```

Quá trình này được thực hiện **đệ quy** cho đến rank thấp nhất được cấu hình hiển thị.

---

## 3. Dữ liệu của mỗi Mock Node

Mỗi node được Frontend sinh ra có cấu trúc tương tự:

```ts
{
  id: "mock-r10-1",
  type: "treeNode",
  position: {
    x: 0,
    y: 0
  },
  data: {
    isMock: true,
    name: "User mẫu #1",

    rank: 10,
    rankName: "Hoàng quan 3 sao",

    teamPercent: 13,
    referralPercent: 10,
    globalFundTier: 10,

    promotionRule: {
      requiredF1Rank: 9,
      count: 2
    }
  }
}
```

`position` ban đầu không cần tính toán thủ công. Sau khi generate node và edge, **Dagre** sẽ tự động tính vị trí.

---

## 4. Nguồn dữ liệu

### 4.1. Rank API

Cung cấp thông tin của từng rank:

```text
rank
name
nameI18n
teamPercent
referralPercent
globalFundTier
isActive
```

Ví dụ:

```text
Rank 10
Hoàng quan 3 sao
Team: 13%
Referral: 10%
Global Fund Tier: 10
```

### 4.2. Promotion Rule API

Cung cấp điều kiện để một rank được nâng lên rank tiếp theo:

```text
fromRank
toRank
mode
requiredF1Rank
count
isActive
```

Ví dụ:

```text
fromRank: 9
toRank: 10
mode: f1_rank
requiredF1Rank: 9
count: 2
```

Frontend **không hard-code điều kiện rank** mà lấy trực tiếp từ Promotion Rule API.

---

## 5. Quy trình xử lý Frontend

```text
Rank API
   │
   │
   ├───────────────┐
   │               │
   ▼               ▼
Ranks          Promotion Rules
   │               │
   └───────┬───────┘
           ▼
   Build Rank Map
   Build Rule Map
           │
           ▼
 generatePromotionTree()
           │
           ├── Generate Mock Nodes
           │
           └── Generate Edges
           │
           ▼
 getLayoutedElements()
           │
           ▼
        Dagre
           │
           ▼
       React Flow
```

---

## 6. Quy tắc generate

Frontend bắt đầu từ rank cao nhất cần minh họa.

Ví dụ chọn **Rank 10** làm root:

```text
Rank 10
```

Tìm promotion rule của Rank 10:

```text
Rank 9 → Rank 10
requiredF1Rank = 9
count = 2
```

→ Sinh 2 node Rank 9.

Sau đó với **mỗi node Rank 9**, tìm rule:

```text
Rank 8 → Rank 9
requiredF1Rank = 8
count = 3
```

→ Mỗi Rank 9 sinh 3 node Rank 8.

Tiếp tục đệ quy.

---

## 7. Ví dụ với cấu hình hiện tại

Nếu chỉ minh họa từ **R10 → R7**:

```text
R10
│
├── R9
│   ├── R8
│   │   ├── R7
│   │   ├── R7
│   │   └── R7
│   │
│   ├── R8
│   │   ├── R7
│   │   ├── R7
│   │   └── R7
│   │
│   └── R8
│       ├── R7
│       ├── R7
│       └── R7
│
└── R9
    ├── R8
    │   ├── R7
    │   ├── R7
    │   └── R7
    ├── R8
    │   ├── R7
    │   ├── R7
    │   └── R7
    └── R8
        ├── R7
        ├── R7
        └── R7
```

Số node:

```text
R10 = 1
R9  = 2
R8  = 6
R7  = 18
──────────
Total = 27 mock nodes
```

---

## 8. React Flow và Dagre

Sau khi sinh được `nodes` và `edges`:

```text
Mock Nodes
    +
Edges
    │
    ▼
Dagre
    │
    │ rankdir = TB
    ▼
Auto Layout
    │
    ▼
React Flow
```

Dagre chịu trách nhiệm:

- Xác định vị trí node.
- Đảm bảo các rank được xếp theo chiều từ trên xuống dưới.
- Tự động phân bố khoảng cách giữa các node.
- Hạn chế việc các node bị chồng lên nhau.

React Flow chịu trách nhiệm:

- Render node.
- Render edge.
- Zoom / pan.
- Tương tác với cây.
- Hiển thị Custom Node.

---

## 9. Custom Node

Mỗi mock user được hiển thị dưới dạng card:

```text
┌───────────────────────────────┐
│ 👑 HOÀNG QUAN 3 SAO · R10    │
├───────────────────────────────┤
│                               │
│       ◯  User mẫu #1          │
│          Mock User             │
│                               │
│  Team Commission       13%    │
│  Referral Commission   10%    │
│  Global Fund Tier       10    │
│                               │
│  ─────────────────────────    │
│  Điều kiện thăng hạng         │
│  Cần 2 F1 đạt Rank 9          │
│                               │
└───────────────────────────────┘
```

Node có:

```tsx
<Handle type="target" position="top" />
```

và:

```tsx
<Handle type="source" position="bottom" />
```

Edge:

```ts
{
  type: "smoothstep"
}
```

---

## 10. Lợi ích của cách triển khai

Cách này giúp hệ thống **không phụ thuộc vào số lượng user thực tế**.

Ví dụ hiện tại chỉ có:

```text
Rank API
+
Promotion Rule API
```

vẫn có thể tạo được cây:

```text
R10
 ↓
2 × R9
 ↓
3 × R8
 ↓
3 × R7
```

Nếu sau này admin thay đổi rule:

```text
R9 → R10
count: 2
```

thành:

```text
R9 → R10
count: 3
```

Frontend tự động chuyển từ:

```text
        R10
       /   \
      R9   R9
```

thành:

```text
          R10
       /   |   \
      R9  R9   R9
```

**Không cần sửa logic Frontend.**

---

## 11. Lưu ý về dữ liệu

Cây này là **cây mô phỏng**, không phải MLM genealogy thực tế.

Do đó:

- Không cần API lấy user.
- Không cần lưu mock node xuống database.
- Không cần lưu cấu trúc cây xuống database.
- Không cần tạo user giả trong database.
- Không sử dụng `userId` thực tế.
- Không dùng cây để xác định commission hoặc rank thực tế.

`Rank API` và `Promotion Rule API` là **source of truth**.

Frontend chỉ thực hiện:

```text
Rank + Promotion Rules
        ↓
Transform
        ↓
Mock Tree
        ↓
Dagre Layout
        ↓
React Flow
```

---

## 12. Mở rộng

Có thể giới hạn số tầng render để tránh tạo quá nhiều node.

Ví dụ:

```ts
generatePromotionTree({
  rootRank: 10,
  minRank: 7
});
```

Kết quả:

```text
R10
 ↓
R9
 ↓
R8
 ↓
R7
```

Tổng cộng **27 mock nodes**.

Nếu cần hiển thị toàn bộ từ R10 xuống R1 thì số node có thể tăng rất lớn, do đó nên hỗ trợ:

- Giới hạn depth.
- Expand / Collapse.
- Lazy generation.
- Chỉ generate những nhánh đang được người dùng mở.

---

## 13. Kết luận

**Promotion Rule Tree** là một cây mô phỏng được Frontend sinh động từ dữ liệu Rank và Promotion Rule.

Mỗi node là một **mock user** đại diện cho một vị trí trong cấu trúc điều kiện thăng hạng, không phải user thực tế.

Frontend sử dụng:

- **React** để quản lý UI và state.
- **React Flow** để render cây.
- **Dagre** để tự động tính layout.
- **Custom Node** để hiển thị thông tin rank và điều kiện.
- **Rank API + Promotion Rule API** làm nguồn dữ liệu.

Kiến trúc tổng thể:

```text
                    Backend
                       │
             ┌─────────┴─────────┐
             │                   │
          Rank API         Promotion Rule API
             │                   │
             └─────────┬─────────┘
                       ▼
             generatePromotionTree()
                       │
                Mock User Nodes
                       │
                  Mock Edges
                       │
                       ▼
                 Dagre Layout
                       │
                       ▼
                  React Flow
                       │
                       ▼
              Promotion Rule Tree
```
