diff --git a/lib/i18n/receipt-copy.ts b/lib/i18n/receipt-copy.ts
index 2d64c8e5731e0bb7f3c36b09ede986f0470f3240..692d477094cb85af070b3a5f47aa69d551051fc9 100644
--- a/lib/i18n/receipt-copy.ts
+++ b/lib/i18n/receipt-copy.ts
@@ -1,59 +1,74 @@
 import type { Locale } from '@/lib/i18n/config';
 import type { ReceiptCopy } from '@/lib/payment-receipt';
 
 const receiptCopyByLocale: Record<Locale, Required<ReceiptCopy> & { title: string; detailsHeading: string; paidInFull: string }> = {
   en: {
     title: 'Payment receipt',
     detailsHeading: 'Receipt details',
     paidInFull: 'Paid in full',
     paidOnPrefix: 'Paid on',
     paidOnUnknown: 'Paid on an unknown date.',
     amountPaid: 'Amount paid',
     customerDetails: 'Customer details',
     service: 'Service',
     paymentDate: 'Payment date',
     paymentMethod: 'Payment method',
     reference: 'Reference',
+    quotedPrice: 'Quoted price',
+    amountReceived: 'Amount received',
+    paymentDifference: 'Difference',
+    differenceReason: 'Reason',
+    additionalAmountReceived: 'Additional amount received',
     remainingBalance: 'Remaining balance',
     thankYou: 'Thank you for your payment.',
     keepCopy: 'Please keep this receipt for your records.'
   },
   es: {
     title: 'Recibo de pago',
     detailsHeading: 'Detalles del recibo',
     paidInFull: 'Pagado por completo',
     paidOnPrefix: 'Pagado el',
     paidOnUnknown: 'Pagado en una fecha desconocida.',
     amountPaid: 'Monto pagado',
     customerDetails: 'Datos del cliente',
     service: 'Servicio',
     paymentDate: 'Fecha de pago',
     paymentMethod: 'Método de pago',
     reference: 'Referencia',
+    quotedPrice: 'Precio cotizado',
+    amountReceived: 'Monto recibido',
+    paymentDifference: 'Diferencia',
+    differenceReason: 'Motivo',
+    additionalAmountReceived: 'Monto adicional recibido',
     remainingBalance: 'Saldo restante',
     thankYou: 'Gracias por su pago.',
     keepCopy: 'Conserve este recibo para sus registros.'
   },
   vi: {
     title: 'Biên lai thanh toán',
     detailsHeading: 'Chi tiết biên lai',
     paidInFull: 'Đã thanh toán đủ',
     paidOnPrefix: 'Đã thanh toán vào',
     paidOnUnknown: 'Đã thanh toán vào ngày không xác định.',
     amountPaid: 'Số tiền đã trả',
     customerDetails: 'Thông tin khách hàng',
     service: 'Dịch vụ',
     paymentDate: 'Ngày thanh toán',
     paymentMethod: 'Phương thức thanh toán',
     reference: 'Mã tham chiếu',
+    quotedPrice: 'Giá đã báo',
+    amountReceived: 'Số tiền đã nhận',
+    paymentDifference: 'Chênh lệch',
+    differenceReason: 'Lý do',
+    additionalAmountReceived: 'Số tiền nhận thêm',
     remainingBalance: 'Số dư còn lại',
     thankYou: 'Cảm ơn bạn đã thanh toán.',
     keepCopy: 'Vui lòng giữ biên lai này để đối chiếu.'
   }
 };
 
 export function getReceiptCopy(locale: string | null | undefined) {
   const normalized = String(locale || 'en').toLowerCase().slice(0, 2);
   if (normalized === 'es' || normalized === 'vi') return receiptCopyByLocale[normalized];
   return receiptCopyByLocale.en;
 }
