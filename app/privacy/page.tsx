'use client';

import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { useTranslation } from '@/components/locale-provider';
import { PRIVACY_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

const copy = {
  en: {
    title: 'Privacy Policy', version: 'Version', updated: 'Last updated September 2026', back: 'Back to login', terms: 'Terms of Service', cookies: 'Cookie Policy', security: 'Security',
    sections: [
      ['Overview', `EverittOS stores account, organization, job, customer, worker, photo, document, report, message, export, and activity data to operate your workspace, support your team, maintain security, and improve reliability.`],
      ['Data we collect', `We may collect account and authentication data, operational records, team and role information, client portal activity, billing references, device/browser metadata, and security logs. Payment card details remain with Stripe.`],
      ['Workspace, team, and client visibility', `EverittOS is a shared business workspace. Authorized owners and administrators may view workspace records. Workers, contractors, viewers, and clients receive limited access based on role, assignment, portal access, or explicit sharing.`],
      ['Exports and downloads', `Authorized users may create or download reports, spreadsheets, invoices, receipts, photos, documents, and other files from records they are permitted to access.`],
      ['Why we process data', `We process data to provide and secure EverittOS, support collaboration and notifications, fulfill user requests, and comply with legal obligations.`],
      ['AI-assisted features', `When AI-assisted features are used, relevant workspace information may be processed to generate requested summaries, recommendations, drafts, analyses, or other content. Users should review generated content before relying on it.`],
      ['Retention', `Active workspace data is retained while your account is active. Deleted accounts may enter a recovery period before permanent removal. Certain billing, security, and audit records may be retained longer where legally required or needed for fraud prevention.`],
      ['Your rights', `Depending on your location, you may have rights to access, export, correct, delete, or restrict processing of personal data. EverittOS does not sell personal information.`],
      ['Authentication', `EverittOS supports email/password sign-in and optional passkeys on supported devices. Passkey private credentials remain on your device or password manager; EverittOS stores only verification metadata required for sign-in.`],
      ['Security', `Access is limited by role, assignment, explicit sharing, client portal permissions, and row-level security policies. Photos and documents are stored in secure storage tied to your organization.`],
      ['International transfers', `Data may be processed in the United States and other regions where infrastructure providers operate, subject to their applicable safeguards and data-processing terms.`],
      ['Contact', `For privacy or data-access questions, contact ${SUPPORT_EMAIL}.`]
    ]
  },
  es: {
    title: 'Política de privacidad', version: 'Versión', updated: 'Última actualización: septiembre de 2026', back: 'Volver al inicio de sesión', terms: 'Términos de servicio', cookies: 'Política de cookies', security: 'Seguridad',
    sections: [
      ['Resumen', `EverittOS almacena datos de cuenta, organización, trabajos, clientes, trabajadores, fotos, documentos, informes, mensajes, exportaciones y actividad para operar tu espacio de trabajo, apoyar a tu equipo, mantener la seguridad y mejorar la confiabilidad.`],
      ['Datos que recopilamos', `Podemos recopilar datos de cuenta y autenticación, registros operativos, información de equipo y roles, actividad del portal del cliente, referencias de facturación, metadatos del dispositivo o navegador y registros de seguridad. Los datos de tarjeta permanecen con Stripe.`],
      ['Visibilidad del espacio de trabajo, equipo y cliente', `EverittOS es un espacio de trabajo empresarial compartido. Los propietarios y administradores autorizados pueden ver registros del espacio. Trabajadores, contratistas, observadores y clientes reciben acceso limitado según rol, asignación, acceso al portal o uso compartido explícito.`],
      ['Exportaciones y descargas', `Los usuarios autorizados pueden crear o descargar informes, hojas de cálculo, facturas, recibos, fotos, documentos y otros archivos de los registros a los que tengan permiso de acceso.`],
      ['Por qué procesamos datos', `Procesamos datos para ofrecer y proteger EverittOS, apoyar la colaboración y las notificaciones, cumplir solicitudes de usuarios y cumplir obligaciones legales.`],
      ['Funciones asistidas por IA', `Cuando se usan funciones asistidas por IA, la información relevante del espacio de trabajo puede procesarse para generar resúmenes, recomendaciones, borradores, análisis u otro contenido solicitado. Debes revisar el contenido generado antes de confiar en él.`],
      ['Retención', `Los datos activos se conservan mientras la cuenta esté activa. Las cuentas eliminadas pueden entrar en un período de recuperación antes de la eliminación permanente. Algunos registros de facturación, seguridad y auditoría pueden conservarse por más tiempo cuando la ley lo requiera o para prevenir fraude.`],
      ['Tus derechos', `Según tu ubicación, puedes tener derechos para acceder, exportar, corregir, eliminar o restringir el procesamiento de tus datos personales. EverittOS no vende información personal.`],
      ['Autenticación', `EverittOS admite inicio de sesión con correo y contraseña y passkeys opcionales en dispositivos compatibles. Las credenciales privadas de passkey permanecen en tu dispositivo o administrador de contraseñas; EverittOS solo guarda los metadatos necesarios para verificar el inicio de sesión.`],
      ['Seguridad', `El acceso se limita por rol, asignación, uso compartido explícito, permisos del portal del cliente y políticas de seguridad por fila. Las fotos y documentos se guardan en almacenamiento seguro asociado a tu organización.`],
      ['Transferencias internacionales', `Los datos pueden procesarse en Estados Unidos y otras regiones donde operan nuestros proveedores de infraestructura, sujetos a sus protecciones y términos de procesamiento de datos.`],
      ['Contacto', `Para preguntas de privacidad o acceso a datos, contacta a ${SUPPORT_EMAIL}.`]
    ]
  },
  vi: {
    title: 'Chính sách quyền riêng tư', version: 'Phiên bản', updated: 'Cập nhật lần cuối: tháng 9 năm 2026', back: 'Quay lại đăng nhập', terms: 'Điều khoản dịch vụ', cookies: 'Chính sách cookie', security: 'Bảo mật',
    sections: [
      ['Tổng quan', `EverittOS lưu trữ dữ liệu tài khoản, tổ chức, công việc, khách hàng, nhân viên, ảnh, tài liệu, báo cáo, tin nhắn, dữ liệu xuất và hoạt động để vận hành không gian làm việc, hỗ trợ nhóm, duy trì bảo mật và cải thiện độ tin cậy.`],
      ['Dữ liệu chúng tôi thu thập', `Chúng tôi có thể thu thập dữ liệu tài khoản và xác thực, hồ sơ vận hành, thông tin nhóm và vai trò, hoạt động cổng khách hàng, tham chiếu thanh toán, siêu dữ liệu thiết bị hoặc trình duyệt và nhật ký bảo mật. Thông tin thẻ thanh toán được Stripe lưu giữ.`],
      ['Khả năng hiển thị trong không gian làm việc', `EverittOS là không gian làm việc doanh nghiệp dùng chung. Chủ sở hữu và quản trị viên được ủy quyền có thể xem hồ sơ trong không gian. Nhân viên, nhà thầu, người xem và khách hàng có quyền truy cập giới hạn dựa trên vai trò, phân công, quyền cổng thông tin hoặc chia sẻ rõ ràng.`],
      ['Xuất và tải xuống', `Người dùng được ủy quyền có thể tạo hoặc tải xuống báo cáo, bảng tính, hóa đơn, biên lai, ảnh, tài liệu và các tệp khác từ hồ sơ mà họ được phép truy cập.`],
      ['Lý do xử lý dữ liệu', `Chúng tôi xử lý dữ liệu để cung cấp và bảo vệ EverittOS, hỗ trợ cộng tác và thông báo, thực hiện yêu cầu của người dùng và tuân thủ nghĩa vụ pháp lý.`],
      ['Tính năng có hỗ trợ AI', `Khi sử dụng tính năng có hỗ trợ AI, thông tin liên quan trong không gian làm việc có thể được xử lý để tạo tóm tắt, đề xuất, bản nháp, phân tích hoặc nội dung được yêu cầu. Người dùng nên xem lại nội dung được tạo trước khi dựa vào nội dung đó.`],
      ['Lưu giữ', `Dữ liệu đang hoạt động được lưu khi tài khoản còn hoạt động. Tài khoản đã xóa có thể trải qua thời gian khôi phục trước khi bị xóa vĩnh viễn. Một số hồ sơ thanh toán, bảo mật và kiểm toán có thể được lưu lâu hơn khi pháp luật yêu cầu hoặc để phòng chống gian lận.`],
      ['Quyền của bạn', `Tùy vị trí, bạn có thể có quyền truy cập, xuất, sửa, xóa hoặc hạn chế việc xử lý dữ liệu cá nhân. EverittOS không bán thông tin cá nhân.`],
      ['Xác thực', `EverittOS hỗ trợ đăng nhập bằng email/mật khẩu và passkey tùy chọn trên thiết bị được hỗ trợ. Thông tin riêng tư của passkey vẫn ở trên thiết bị hoặc trình quản lý mật khẩu; EverittOS chỉ lưu siêu dữ liệu cần thiết để xác minh đăng nhập.`],
      ['Bảo mật', `Quyền truy cập được giới hạn theo vai trò, phân công, chia sẻ rõ ràng, quyền cổng khách hàng và chính sách bảo mật cấp hàng. Ảnh và tài liệu được lưu trong bộ nhớ bảo mật gắn với tổ chức của bạn.`],
      ['Chuyển dữ liệu quốc tế', `Dữ liệu có thể được xử lý tại Hoa Kỳ và các khu vực khác nơi nhà cung cấp hạ tầng hoạt động, theo các biện pháp bảo vệ và điều khoản xử lý dữ liệu của họ.`],
      ['Liên hệ', `Nếu có câu hỏi về quyền riêng tư hoặc truy cập dữ liệu, hãy liên hệ ${SUPPORT_EMAIL}.`]
    ]
  }
} as const;

export default function PrivacyPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>{c.title}</h2>
        <p className="muted">{c.version} {PRIVACY_VERSION} · {c.updated}</p>
        {c.sections.map(([heading, body]) => (
          <section key={heading}>
            <h3>{heading}</h3>
            <p>{body}</p>
          </section>
        ))}
        <p><Link href="/terms">{c.terms}</Link> · <Link href="/cookies">{c.cookies}</Link> · <Link href="/security">{c.security}</Link></p>
        <LegalNotice />
        <Link className="btn" href="/login">{c.back}</Link>
      </div>
    </main>
  );
}
