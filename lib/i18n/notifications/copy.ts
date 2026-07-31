import type { Locale } from "@/lib/i18n/types";

export type NotificationCopy = { title: string; body: string };

/** FE-owned notification copy keyed by BE `NotificationType`. */
export const NOTIFICATION_TYPE_COPY: Record<
  Locale,
  Record<string, NotificationCopy>
> = {
  en: {
    ACCOUNT_LOCKED: {
      title: "Account locked",
      body: "Your account has been locked. Contact support if you need help.",
    },
    ACCOUNT_UNLOCKED: {
      title: "Account unlocked",
      body: "Your account is active again. You can sign in normally.",
    },
    ACCOUNT_DELETED: {
      title: "Account deleted",
      body: "Your account has been deleted.",
    },
    STAFF_ROLE_ASSIGNED: {
      title: "Staff role updated",
      body: "Your staff role for shop {shopId} has been updated.",
    },
    PLATFORM_ADMIN_ACCOUNT: {
      title: "Platform admin account",
      body: "Your platform admin account is ready.",
    },
    DSAR_REQUEST_NEW: {
      title: "New data erasure request",
      body: "A new DSAR request needs review.",
    },
    REFERRAL_DOWNLINE_JOINED: {
      title: "New referral joined",
      body: "Someone joined using your referral link.",
    },
    SHOP_APPLICATION_NEW: {
      title: "New shop application",
      body: "Shop {shopId} submitted an application for review.",
    },
    SHOP_APPROVED: {
      title: "Shop approved",
      body: "Your shop application was approved. You can start selling.",
    },
    SHOP_REJECTED: {
      title: "Shop rejected",
      body: "Your shop application was rejected.{reason}",
    },
    SHOP_SUSPENDED: {
      title: "Shop suspended",
      body: "Your shop has been suspended. Contact admin if you need help.",
    },
    SHOP_REINSTATED: {
      title: "Shop reinstated",
      body: "Your shop is active again.",
    },
    SHOP_BANK_INFO_SETUP: {
      title: "Set up your bank account",
      body: "Your shop was approved. Please add bank info to receive payouts.",
    },
    SHOP_BANK_INFO_REMINDER: {
      title: "Bank info required for payouts",
      body: "An order was delivered but your shop has no bank info. Update now to receive payouts.",
    },
    SELLER_PAYOUT_COMPLETED: {
      title: "Payout completed",
      body: "Your payout of {amount} has been transferred to your bank account.",
    },
    SELLER_PAYOUT_REJECTED: {
      title: "Payout rejected",
      body: "Your payout of {amount} was rejected.{reason}",
    },
    PRODUCT_APPROVED: {
      title: "Product approved",
      body: "Product {productId} is approved and visible to buyers.",
    },
    PRODUCT_REJECTED: {
      title: "Product rejected",
      body: "Product {productId} was rejected.{reason}",
    },
    PRODUCT_HIDDEN: {
      title: "Product hidden",
      body: "Product {productId} is hidden from the storefront.",
    },
    ORDER_NEW: {
      title: "New order",
      body: "You received order {orderId}.",
    },
    ORDER_STATUS_UPDATED: {
      title: "Order updated",
      body: "Order {orderId} is now {status}.",
    },
    ORDER_CANCELLED: {
      title: "Order cancelled",
      body: "Order {orderId} was cancelled.",
    },
    ORDER_CREATED_BY_ADMIN: {
      title: "Order created for you",
      body: "An order {orderId} was placed on your behalf.",
    },
    ORDER_CREATED_PAYMENT_NEEDED: {
      title: "Payment needed",
      body: "Order {orderId} was created. Complete payment to continue.",
    },
    RMA_NEW: {
      title: "New return request",
      body: "Return request {rmaId} needs review.",
    },
    RMA_APPROVED: {
      title: "Return approved",
      body: "Return {rmaId} was approved.",
    },
    RMA_REJECTED: {
      title: "Return rejected",
      body: "Return {rmaId} was rejected.",
    },
    RMA_REFUND_COMPLETED: {
      title: "Refund completed",
      body: "Refund for return {rmaId} is complete.",
    },
    RMA_APPROVED_EXTERNAL_REFUND: {
      title: "Refund approved",
      body: "Return {rmaId} approved — payout handled outside the system.",
    },
    REVIEW_NEW: {
      title: "New product review",
      body: "A new review was posted on product {productId}.",
    },
    REVIEW_SELLER_REPLIED: {
      title: "Seller replied to your review",
      body: "The shop responded to your review on product {productId}.",
    },
    REVIEW_HIDDEN: {
      title: "Review hidden",
      body: "Your review on product {productId} was hidden.",
    },
    REVIEW_UNHIDDEN: {
      title: "Review visible again",
      body: "Your review on product {productId} is visible again.",
    },
    PROMOTION_APPROVED: {
      title: "Promotion approved",
      body: "Promotion {promotionId} is active.",
    },
    PROMOTION_REJECTED: {
      title: "Promotion rejected",
      body: "Promotion {promotionId} was rejected.",
    },
    WALLET_PIN_UPDATED: {
      title: "Wallet PIN updated",
      body: "Your wallet PIN was changed successfully.",
    },
    WALLET_TRANSFER_SENT: {
      title: "Transfer sent",
      body: "You sent {amount} from your wallet.",
    },
    WALLET_TRANSFER_RECEIVED: {
      title: "Transfer received",
      body: "You received {amount} in your wallet.",
    },
    WALLET_ADJUSTED: {
      title: "Wallet adjusted",
      body: "Your wallet balance was adjusted by an administrator.",
    },
    WALLET_WITHDRAW_REQUESTED: {
      title: "Withdrawal requested",
      body: "Withdrawal {payoutId} is pending review.",
    },
    WALLET_WITHDRAW_NEW: {
      title: "New withdrawal request",
      body: "Withdrawal {payoutId} needs staff review.",
    },
    WALLET_WITHDRAW_APPROVED: {
      title: "Withdrawal approved",
      body: "Withdrawal {payoutId} was approved.",
    },
    WALLET_WITHDRAW_REJECTED: {
      title: "Withdrawal rejected",
      body: "Withdrawal {payoutId} was rejected.",
    },
    WALLET_WITHDRAW_COMPLETED: {
      title: "Withdrawal completed",
      body: "Withdrawal {payoutId} was paid out.",
    },
    WALLET_WITHDRAW_PAY_FAILED: {
      title: "Withdrawal payment failed",
      body: "Payment for withdrawal {payoutId} failed.",
    },
    WALLET_WITHDRAW_STAFF_APPROVED: {
      title: "Withdrawal approved",
      body: "Withdrawal {payoutId} was approved.",
    },
    WALLET_WITHDRAW_STAFF_REJECTED: {
      title: "Withdrawal rejected",
      body: "Withdrawal {payoutId} was rejected.",
    },
    WALLET_WITHDRAW_STAFF_PROCESSED: {
      title: "Withdrawal processed",
      body: "Withdrawal {payoutId} was marked processed.",
    },
    WALLET_WITHDRAW_STAFF_PAY_FAILED: {
      title: "Withdrawal payout failed",
      body: "Payout for {payoutId} failed.",
    },
    COMMISSION_REFERRAL_CREDITED: {
      title: "Referral commission",
      body: "Referral commission {amount} was credited to your wallet.",
    },
    COMMISSION_TEAM_CREDITED: {
      title: "Team commission",
      body: "Team commission {amount} was credited to your wallet.",
    },
    COMMISSION_GLOBAL_CREDITED: {
      title: "Global bonus",
      body: "Global bonus {amount} was credited to your wallet.",
    },
    COMMISSION_LOYALTY_CREDITED: {
      title: "Loyalty bonus",
      body: "Loyalty bonus {amount} was credited to your wallet.",
    },
    COMMISSION_REFERRAL_TRIGGERED: {
      title: "Referral commission triggered",
      body: "A referral commission was triggered for order {orderId}.",
    },
    COMMISSION_REFERRAL_SKIPPED_NOT_SELLER: {
      title: "Commission not credited",
      body: "Referral commission was skipped — seller shop required.",
    },
    COMMISSION_JOB_FAILED: {
      title: "Commission job failed",
      body: "Commission processing failed for order {orderId}.",
    },
    MLM_RANK_UPGRADED: {
      title: "Rank upgraded",
      body: "Your MLM rank is now {mlmRank}.",
    },
    MLM_RANK_UPDATED: {
      title: "Rank updated",
      body: "Your MLM rank changed from {previousRank} to {mlmRank}.",
    },
    MLM_REFERRER_UPDATED: {
      title: "Referrer updated",
      body: "Your referrer assignment was updated.",
    },
    MLM_DOWNLINE_ASSIGNED: {
      title: "Downline assigned",
      body: "A new member was assigned to your network.",
    },
    MLM_REFERRAL_RATE_UPDATED: {
      title: "Referral rate updated",
      body: "Platform referral rates were updated.",
    },
    INVENTORY_SLIP_PENDING: {
      title: "New inventory slip",
      body: "Slip {code} needs approval.",
    },
    INVENTORY_SLIP_APPROVED: {
      title: "Inventory slip approved",
      body: "Slip {code} was approved.",
    },
    INVENTORY_SLIP_REJECTED: {
      title: "Inventory slip rejected",
      body: "Slip {code} was rejected.",
    },
    INVENTORY_TRANSFER_PENDING: {
      title: "New warehouse transfer",
      body: "Transfer {code} needs approval.",
    },
    INVENTORY_TRANSFER_APPROVED: {
      title: "Transfer shipped",
      body: "Transfer {code} is in transit.",
    },
    INVENTORY_TRANSFER_RECEIVED: {
      title: "Transfer received",
      body: "Transfer {code} was received at the destination warehouse.",
    },
  },
  vi: {
    ACCOUNT_LOCKED: {
      title: "Tài khoản bị khóa",
      body: "Tài khoản của bạn đã bị khóa. Liên hệ hỗ trợ nếu cần.",
    },
    ACCOUNT_UNLOCKED: {
      title: "Tài khoản đã mở khóa",
      body: "Tài khoản của bạn đã hoạt động trở lại.",
    },
    ACCOUNT_DELETED: {
      title: "Tài khoản đã xóa",
      body: "Tài khoản của bạn đã được xóa.",
    },
    STAFF_ROLE_ASSIGNED: {
      title: "Cập nhật vai trò nhân sự",
      body: "Vai trò nhân sự của bạn tại shop {shopId} đã được cập nhật.",
    },
    PLATFORM_ADMIN_ACCOUNT: {
      title: "Tài khoản admin nền tảng",
      body: "Tài khoản admin nền tảng của bạn đã sẵn sàng.",
    },
    DSAR_REQUEST_NEW: {
      title: "Yêu cầu xóa dữ liệu mới",
      body: "Có yêu cầu DSAR cần duyệt.",
    },
    REFERRAL_DOWNLINE_JOINED: {
      title: "Người giới thiệu mới",
      body: "Có người tham gia qua liên kết giới thiệu của bạn.",
    },
    SHOP_APPLICATION_NEW: {
      title: "Đơn đăng ký shop mới",
      body: "Shop {shopId} đã gửi đơn chờ duyệt.",
    },
    SHOP_APPROVED: {
      title: "Shop đã duyệt",
      body: "Đơn đăng ký shop của bạn đã được duyệt. Bạn có thể bán hàng.",
    },
    SHOP_REJECTED: {
      title: "Shop bị từ chối",
      body: "Đơn đăng ký shop bị từ chối.{reason}",
    },
    SHOP_SUSPENDED: {
      title: "Shop bị tạm khóa",
      body: "Shop của bạn đã bị tạm khóa. Liên hệ admin nếu cần.",
    },
    SHOP_REINSTATED: {
      title: "Shop hoạt động trở lại",
      body: "Shop của bạn đã được mở lại.",
    },
    SHOP_BANK_INFO_SETUP: {
      title: "Thiết lập tài khoản ngân hàng",
      body: "Shop đã được duyệt. Vui lòng thêm thông tin ngân hàng để nhận thanh toán.",
    },
    SHOP_BANK_INFO_REMINDER: {
      title: "Cần cập nhật thông tin ngân hàng để nhận chi trả",
      body: "Đơn hàng đã giao nhưng shop chưa có thông tin ngân hàng. Cập nhật ngay để nhận thanh toán.",
    },
    SELLER_PAYOUT_COMPLETED: {
      title: "Đã chi trả",
      body: "Khoản chi trả {amount} đã được chuyển vào tài khoản ngân hàng của bạn.",
    },
    SELLER_PAYOUT_REJECTED: {
      title: "Chi trả bị từ chối",
      body: "Khoản chi trả {amount} đã bị từ chối.{reason}",
    },
    PRODUCT_APPROVED: {
      title: "Sản phẩm đã duyệt",
      body: "Sản phẩm {productId} đã duyệt và hiển thị với người mua.",
    },
    PRODUCT_REJECTED: {
      title: "Sản phẩm bị từ chối",
      body: "Sản phẩm {productId} bị từ chối.{reason}",
    },
    PRODUCT_HIDDEN: {
      title: "Sản phẩm đã ẩn",
      body: "Sản phẩm {productId} đã bị ẩn khỏi cửa hàng.",
    },
    ORDER_NEW: {
      title: "Đơn hàng mới",
      body: "Bạn có đơn hàng mới {orderId}.",
    },
    ORDER_STATUS_UPDATED: {
      title: "Cập nhật đơn hàng",
      body: "Đơn {orderId} hiện ở trạng thái {status}.",
    },
    ORDER_CANCELLED: {
      title: "Đơn đã hủy",
      body: "Đơn {orderId} đã bị hủy.",
    },
    ORDER_CREATED_BY_ADMIN: {
      title: "Đơn được tạo hộ",
      body: "Đơn {orderId} được tạo thay mặt bạn.",
    },
    ORDER_CREATED_PAYMENT_NEEDED: {
      title: "Cần thanh toán",
      body: "Đơn {orderId} đã tạo. Hoàn tất thanh toán để tiếp tục.",
    },
    RMA_NEW: {
      title: "Yêu cầu đổi trả mới",
      body: "Yêu cầu {rmaId} cần duyệt.",
    },
    RMA_APPROVED: {
      title: "Đổi trả đã duyệt",
      body: "Yêu cầu {rmaId} đã được duyệt.",
    },
    RMA_REJECTED: {
      title: "Đổi trả bị từ chối",
      body: "Yêu cầu {rmaId} bị từ chối.",
    },
    RMA_REFUND_COMPLETED: {
      title: "Hoàn tiền xong",
      body: "Hoàn tiền cho yêu cầu {rmaId} đã hoàn tất.",
    },
    RMA_APPROVED_EXTERNAL_REFUND: {
      title: "Đã duyệt hoàn",
      body: "Yêu cầu {rmaId} đã duyệt — chi trả ngoài hệ thống.",
    },
    REVIEW_NEW: {
      title: "Đánh giá mới",
      body: "Có đánh giá mới cho sản phẩm {productId}.",
    },
    REVIEW_SELLER_REPLIED: {
      title: "Shop đã trả lời đánh giá",
      body: "Shop đã phản hồi đánh giá của bạn trên sản phẩm {productId}.",
    },
    REVIEW_HIDDEN: {
      title: "Đánh giá bị ẩn",
      body: "Đánh giá của bạn trên sản phẩm {productId} đã bị ẩn.",
    },
    REVIEW_UNHIDDEN: {
      title: "Đánh giá hiển thị lại",
      body: "Đánh giá của bạn trên sản phẩm {productId} đã hiện lại.",
    },
    PROMOTION_APPROVED: {
      title: "Khuyến mãi đã duyệt",
      body: "Khuyến mãi {promotionId} đã kích hoạt.",
    },
    PROMOTION_REJECTED: {
      title: "Khuyến mãi bị từ chối",
      body: "Khuyến mãi {promotionId} bị từ chối.",
    },
    WALLET_PIN_UPDATED: {
      title: "Đã cập nhật PIN ví",
      body: "PIN ví của bạn đã được đổi.",
    },
    WALLET_TRANSFER_SENT: {
      title: "Đã chuyển tiền",
      body: "Bạn đã chuyển {amount} từ ví.",
    },
    WALLET_TRANSFER_RECEIVED: {
      title: "Đã nhận tiền",
      body: "Bạn nhận {amount} vào ví.",
    },
    WALLET_ADJUSTED: {
      title: "Ví được điều chỉnh",
      body: "Số dư ví được admin điều chỉnh.",
    },
    WALLET_WITHDRAW_REQUESTED: {
      title: "Yêu cầu rút tiền",
      body: "Lệnh rút {payoutId} đang chờ duyệt.",
    },
    WALLET_WITHDRAW_NEW: {
      title: "Yêu cầu rút mới",
      body: "Lệnh rút {payoutId} cần nhân viên duyệt.",
    },
    WALLET_WITHDRAW_APPROVED: {
      title: "Rút tiền đã duyệt",
      body: "Lệnh rút {payoutId} đã duyệt.",
    },
    WALLET_WITHDRAW_REJECTED: {
      title: "Rút tiền bị từ chối",
      body: "Lệnh rút {payoutId} bị từ chối.",
    },
    WALLET_WITHDRAW_COMPLETED: {
      title: "Rút tiền hoàn tất",
      body: "Lệnh rút {payoutId} đã chi trả.",
    },
    WALLET_WITHDRAW_PAY_FAILED: {
      title: "Chi trả rút tiền thất bại",
      body: "Chi trả cho lệnh rút {payoutId} thất bại.",
    },
    WALLET_WITHDRAW_STAFF_APPROVED: {
      title: "Rút tiền đã duyệt",
      body: "Lệnh rút {payoutId} đã duyệt.",
    },
    WALLET_WITHDRAW_STAFF_REJECTED: {
      title: "Rút tiền bị từ chối",
      body: "Lệnh rút {payoutId} bị từ chối.",
    },
    WALLET_WITHDRAW_STAFF_PROCESSED: {
      title: "Rút tiền đã xử lý",
      body: "Lệnh rút {payoutId} đã được xử lý.",
    },
    WALLET_WITHDRAW_STAFF_PAY_FAILED: {
      title: "Chi trả thất bại",
      body: "Chi trả cho {payoutId} thất bại.",
    },
    COMMISSION_REFERRAL_CREDITED: {
      title: "Hoa hồng giới thiệu",
      body: "Hoa hồng giới thiệu {amount} đã vào ví.",
    },
    COMMISSION_TEAM_CREDITED: {
      title: "Hoa hồng nhóm",
      body: "Hoa hồng nhóm {amount} đã vào ví.",
    },
    COMMISSION_GLOBAL_CREDITED: {
      title: "Thưởng toàn cầu",
      body: "Thưởng toàn cầu {amount} đã vào ví.",
    },
    COMMISSION_LOYALTY_CREDITED: {
      title: "Thưởng trung thành",
      body: "Thưởng trung thành {amount} đã vào ví.",
    },
    COMMISSION_REFERRAL_TRIGGERED: {
      title: "Kích hoạt hoa hồng",
      body: "Hoa hồng giới thiệu được kích hoạt cho đơn {orderId}.",
    },
    COMMISSION_REFERRAL_SKIPPED_NOT_SELLER: {
      title: "Không cộng hoa hồng",
      body: "Bỏ qua hoa hồng — cần shop seller.",
    },
    COMMISSION_JOB_FAILED: {
      title: "Xử lý hoa hồng lỗi",
      body: "Xử lý hoa hồng cho đơn {orderId} thất bại.",
    },
    MLM_RANK_UPGRADED: {
      title: "Thăng hạng",
      body: "Hạng MLM của bạn là {mlmRank}.",
    },
    MLM_RANK_UPDATED: {
      title: "Cập nhật hạng",
      body: "Hạng MLM đổi từ {previousRank} sang {mlmRank}.",
    },
    MLM_REFERRER_UPDATED: {
      title: "Cập nhật người giới thiệu",
      body: "Người giới thiệu của bạn đã được cập nhật.",
    },
    MLM_DOWNLINE_ASSIGNED: {
      title: "Thành viên mới",
      body: "Có thành viên mới trong mạng lưới của bạn.",
    },
    MLM_REFERRAL_RATE_UPDATED: {
      title: "Cập nhật tỷ lệ giới thiệu",
      body: "Tỷ lệ giới thiệu nền tảng đã được cập nhật.",
    },
    INVENTORY_SLIP_PENDING: {
      title: "Phiếu kho mới",
      body: "Phiếu {code} cần được duyệt.",
    },
    INVENTORY_SLIP_APPROVED: {
      title: "Phiếu kho đã duyệt",
      body: "Phiếu {code} đã được duyệt.",
    },
    INVENTORY_SLIP_REJECTED: {
      title: "Phiếu kho bị từ chối",
      body: "Phiếu {code} đã bị từ chối.",
    },
    INVENTORY_TRANSFER_PENDING: {
      title: "Phiếu chuyển kho mới",
      body: "Phiếu chuyển {code} cần được duyệt.",
    },
    INVENTORY_TRANSFER_APPROVED: {
      title: "Đã xuất kho chuyển hàng",
      body: "Phiếu chuyển {code} đang trên đường vận chuyển.",
    },
    INVENTORY_TRANSFER_RECEIVED: {
      title: "Đã nhận hàng chuyển kho",
      body: "Phiếu chuyển {code} đã được kho nhận xác nhận.",
    },
  },
  "zh-TW": {
    ACCOUNT_LOCKED: {
      title: "帳號已鎖定",
      body: "您的帳號已被鎖定，如需協助請聯絡客服。",
    },
    ACCOUNT_UNLOCKED: {
      title: "帳號已解鎖",
      body: "您的帳號已恢復正常使用。",
    },
    ACCOUNT_DELETED: {
      title: "帳號已刪除",
      body: "您的帳號已被刪除。",
    },
    STAFF_ROLE_ASSIGNED: {
      title: "員工角色已更新",
      body: "您在商店 {shopId} 的員工角色已更新。",
    },
    PLATFORM_ADMIN_ACCOUNT: {
      title: "平台管理員帳號",
      body: "您的平台管理員帳號已就緒。",
    },
    DSAR_REQUEST_NEW: {
      title: "新的資料刪除請求",
      body: "有新的 DSAR 請求待審核。",
    },
    REFERRAL_DOWNLINE_JOINED: {
      title: "新下線加入",
      body: "有人透過您的推薦連結加入。",
    },
    SHOP_APPLICATION_NEW: {
      title: "新商店申請",
      body: "商店 {shopId} 已提交申請待審核。",
    },
    SHOP_APPROVED: {
      title: "商店已核准",
      body: "您的商店申請已核准，可以開始銷售。",
    },
    SHOP_REJECTED: {
      title: "商店已拒絕",
      body: "您的商店申請已被拒絕。{reason}",
    },
    SHOP_SUSPENDED: {
      title: "商店已停權",
      body: "您的商店已被停權，如需協助請聯絡管理員。",
    },
    SHOP_REINSTATED: {
      title: "商店已恢復",
      body: "您的商店已恢復營運。",
    },
    SHOP_BANK_INFO_SETUP: {
      title: "請設定銀行帳戶",
      body: "商店已核准。請新增銀行資料以接收撥款。",
    },
    SHOP_BANK_INFO_REMINDER: {
      title: "撥款需要銀行資料",
      body: "訂單已送達但商店尚無銀行資料。請立即更新以接收撥款。",
    },
    SELLER_PAYOUT_COMPLETED: {
      title: "已完成撥款",
      body: "您的撥款 {amount} 已轉入您的銀行帳戶。",
    },
    SELLER_PAYOUT_REJECTED: {
      title: "撥款被拒絕",
      body: "您的撥款 {amount} 已被拒絕。{reason}",
    },
    PRODUCT_APPROVED: {
      title: "商品已核准",
      body: "商品 {productId} 已核准並對買家可見。",
    },
    PRODUCT_REJECTED: {
      title: "商品已拒絕",
      body: "商品 {productId} 已被拒絕。{reason}",
    },
    PRODUCT_HIDDEN: {
      title: "商品已隱藏",
      body: "商品 {productId} 已從店面隱藏。",
    },
    ORDER_NEW: {
      title: "新訂單",
      body: "您收到新訂單 {orderId}。",
    },
    ORDER_STATUS_UPDATED: {
      title: "訂單已更新",
      body: "訂單 {orderId} 目前狀態為 {status}。",
    },
    ORDER_CANCELLED: {
      title: "訂單已取消",
      body: "訂單 {orderId} 已取消。",
    },
    ORDER_CREATED_BY_ADMIN: {
      title: "代為建立訂單",
      body: "已代您建立訂單 {orderId}。",
    },
    ORDER_CREATED_PAYMENT_NEEDED: {
      title: "需要付款",
      body: "訂單 {orderId} 已建立，請完成付款。",
    },
    RMA_NEW: {
      title: "新退貨申請",
      body: "退貨申請 {rmaId} 待審核。",
    },
    RMA_APPROVED: {
      title: "退貨已核准",
      body: "退貨 {rmaId} 已核准。",
    },
    RMA_REJECTED: {
      title: "退貨已拒絕",
      body: "退貨 {rmaId} 已拒絕。",
    },
    RMA_REFUND_COMPLETED: {
      title: "退款完成",
      body: "退貨 {rmaId} 的退款已完成。",
    },
    RMA_APPROVED_EXTERNAL_REFUND: {
      title: "退款已核准",
      body: "退貨 {rmaId} 已核准 — 線下退款。",
    },
    REVIEW_NEW: {
      title: "新商品評價",
      body: "商品 {productId} 收到新評價。",
    },
    REVIEW_SELLER_REPLIED: {
      title: "賣家已回覆評價",
      body: "賣家已回覆您在商品 {productId} 的評價。",
    },
    REVIEW_HIDDEN: {
      title: "評價已隱藏",
      body: "您在商品 {productId} 的評價已被隱藏。",
    },
    REVIEW_UNHIDDEN: {
      title: "評價已重新顯示",
      body: "您在商品 {productId} 的評價已重新顯示。",
    },
    PROMOTION_APPROVED: {
      title: "促銷已核准",
      body: "促銷 {promotionId} 已生效。",
    },
    PROMOTION_REJECTED: {
      title: "促銷已拒絕",
      body: "促銷 {promotionId} 已被拒絕。",
    },
    WALLET_PIN_UPDATED: {
      title: "錢包 PIN 已更新",
      body: "您的錢包 PIN 已成功變更。",
    },
    WALLET_TRANSFER_SENT: {
      title: "已轉出",
      body: "您已從錢包轉出 {amount}。",
    },
    WALLET_TRANSFER_RECEIVED: {
      title: "已收到轉帳",
      body: "您的錢包收到 {amount}。",
    },
    WALLET_ADJUSTED: {
      title: "錢包已調整",
      body: "管理員已調整您的錢包餘額。",
    },
    WALLET_WITHDRAW_REQUESTED: {
      title: "已申請提款",
      body: "提款 {payoutId} 待審核。",
    },
    WALLET_WITHDRAW_NEW: {
      title: "新提款申請",
      body: "提款 {payoutId} 待員工審核。",
    },
    WALLET_WITHDRAW_APPROVED: {
      title: "提款已核准",
      body: "提款 {payoutId} 已核准。",
    },
    WALLET_WITHDRAW_REJECTED: {
      title: "提款已拒絕",
      body: "提款 {payoutId} 已拒絕。",
    },
    WALLET_WITHDRAW_COMPLETED: {
      title: "提款完成",
      body: "提款 {payoutId} 已撥款。",
    },
    WALLET_WITHDRAW_PAY_FAILED: {
      title: "提款撥款失敗",
      body: "提款 {payoutId} 撥款失敗。",
    },
    WALLET_WITHDRAW_STAFF_APPROVED: {
      title: "提款已核准",
      body: "提款 {payoutId} 已核准。",
    },
    WALLET_WITHDRAW_STAFF_REJECTED: {
      title: "提款已拒絕",
      body: "提款 {payoutId} 已拒絕。",
    },
    WALLET_WITHDRAW_STAFF_PROCESSED: {
      title: "提款已處理",
      body: "提款 {payoutId} 已標記為已處理。",
    },
    WALLET_WITHDRAW_STAFF_PAY_FAILED: {
      title: "提款撥款失敗",
      body: "提款 {payoutId} 撥款失敗。",
    },
    COMMISSION_REFERRAL_CREDITED: {
      title: "推薦佣金",
      body: "推薦佣金 {amount} 已入帳。",
    },
    COMMISSION_TEAM_CREDITED: {
      title: "團隊佣金",
      body: "團隊佣金 {amount} 已入帳。",
    },
    COMMISSION_GLOBAL_CREDITED: {
      title: "全球獎金",
      body: "全球獎金 {amount} 已入帳。",
    },
    COMMISSION_LOYALTY_CREDITED: {
      title: "忠誠獎金",
      body: "忠誠獎金 {amount} 已入帳。",
    },
    COMMISSION_REFERRAL_TRIGGERED: {
      title: "推薦佣金已觸發",
      body: "訂單 {orderId} 的推薦佣金已觸發。",
    },
    COMMISSION_REFERRAL_SKIPPED_NOT_SELLER: {
      title: "未發放佣金",
      body: "未發放推薦佣金 — 需要賣家商店。",
    },
    COMMISSION_JOB_FAILED: {
      title: "佣金處理失敗",
      body: "訂單 {orderId} 的佣金處理失敗。",
    },
    MLM_RANK_UPGRADED: {
      title: "等級升級",
      body: "您的 MLM 等級為 {mlmRank}。",
    },
    MLM_RANK_UPDATED: {
      title: "等級已更新",
      body: "MLM 等級由 {previousRank} 變更為 {mlmRank}。",
    },
    MLM_REFERRER_UPDATED: {
      title: "推薦人已更新",
      body: "您的推薦人設定已更新。",
    },
    MLM_DOWNLINE_ASSIGNED: {
      title: "新下線指派",
      body: "您的網絡中有新成員。",
    },
    MLM_REFERRAL_RATE_UPDATED: {
      title: "推薦比例已更新",
      body: "平台推薦比例已更新。",
    },
    INVENTORY_SLIP_PENDING: {
      title: "新入庫/調撥單",
      body: "單據 {code} 待審核。",
    },
    INVENTORY_SLIP_APPROVED: {
      title: "單據已核准",
      body: "單據 {code} 已核准。",
    },
    INVENTORY_SLIP_REJECTED: {
      title: "單據已拒絕",
      body: "單據 {code} 已被拒絕。",
    },
    INVENTORY_TRANSFER_PENDING: {
      title: "新調撥單",
      body: "調撥單 {code} 待審核。",
    },
    INVENTORY_TRANSFER_APPROVED: {
      title: "調撥已出貨",
      body: "調撥單 {code} 運送中。",
    },
    INVENTORY_TRANSFER_RECEIVED: {
      title: "調撥已收貨",
      body: "調撥單 {code} 已由目的倉庫確認收貨。",
    },
  },
};

export const NOTIFICATION_FALLBACK_TITLE: Record<Locale, string> = {
  en: "Notification",
  vi: "Thông báo",
  "zh-TW": "通知",
};
