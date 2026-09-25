'use client';

import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { useTranslation } from '@/components/locale-provider';
import { TERMS_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

const copy = {
  en: {
    title: 'Terms of Service', version: 'Version', updated: 'Last updated September 2026', back: 'Back to login',
    sections: [
      ['Agreement', `By creating an account or using EverittOS, you agree to these Terms and our Privacy Policy. If you use EverittOS on behalf of a business, you represent that you have authority to bind that organization.`],
      ['Service', `EverittOS is provided for business operations and field documentation. You are responsible for information uploaded, stored, entered, exported, shared, or managed within your workspace and for complying with laws that apply to your business.`],
      ['Workspace roles and permissions', `Workspace owners and administrators are responsible for invitations, roles, permissions, activity review, and removing access when it is no longer needed. Workers, contractors, viewers, and clients receive access according to role, assignment, or explicit sharing.`],
      ['Exports, reports, and portal files', `Authorized users may generate, download, or share reports, spreadsheets, invoices, receipts, photos, documents, messages, approvals, and other operational files. Organizations are responsible for reviewing exports before distribution.`],
      ['Accounting and third-party sync', `EverittOS is not accounting, bookkeeping, tax, payroll, reconciliation, or financial advisory software. Any accounting sync or export is user-controlled, and you are responsible for reviewing data sent to or received from third-party platforms.`],
      ['Accounts', `You must provide accurate information and keep your credentials, devices, passwords, passkeys, and authentication methods secure. You may deactivate or delete your account through Settings.`],
      ['Billing', `Subscriptions are billed through Stripe and renew automatically unless canceled. Canceling stops future renewals, and access may continue through the current billing period. Prior charges are not refunded unless required by law.`],
      ['Acceptable use', `You may not misuse the platform, attempt unauthorized access, upload malicious content, or use EverittOS in violation of applicable law, privacy rights, contracts, or third-party rights.`],
      ['Changes', `Plans, limits, features, and these Terms may change with reasonable notice. Continued use after a material change means you accept the updated Terms.`],
      ['Disclaimer', `EverittOS is provided “as is” to the extent permitted by law. We do not guarantee uninterrupted service, and liability is limited as permitted by applicable law.`],
      ['Contact', `For billing or account questions, contact ${SUPPORT_EMAIL}.`]
    ]
  },
  es: {
    title: 'Términos de servicio', version: 'Versión', updated: 'Última actualización: septiembre de 2026', back: 'Volver al inicio de sesión',
    sections: [
      ['Acuerdo', `Al crear una cuenta o usar EverittOS, aceptas estos Términos y nuestra Política de privacidad. Si usas EverittOS en nombre de una empresa, declaras que tienes autoridad para obligar a esa organización.`],
      ['Servicio', `EverittOS se ofrece para operaciones empresariales y documentación de campo. Eres responsable de la información cargada, almacenada, ingresada, exportada, compartida o administrada en tu espacio de trabajo y de cumplir las leyes aplicables a tu negocio.`],
      ['Roles y permisos del espacio de trabajo', `Los propietarios y administradores son responsables de invitaciones, roles, permisos, revisión de actividad y eliminación del acceso cuando ya no sea necesario. Trabajadores, contratistas, observadores y clientes reciben acceso según su rol, asignación o uso compartido explícito.`],
      ['Exportaciones, informes y archivos del portal', `Los usuarios autorizados pueden generar, descargar o compartir informes, hojas de cálculo, facturas, recibos, fotos, documentos, mensajes, aprobaciones y otros archivos operativos. La organización es responsable de revisar las exportaciones antes de distribuirlas.`],
      ['Contabilidad y sincronización con terceros', `EverittOS no es software de contabilidad, impuestos, nómina, conciliación ni asesoría financiera. Cualquier sincronización o exportación contable es controlada por el usuario y debes revisar los datos enviados o recibidos de plataformas externas.`],
      ['Cuentas', `Debes proporcionar información correcta y proteger tus credenciales, dispositivos, contraseñas, passkeys y métodos de autenticación. Puedes desactivar o eliminar tu cuenta desde Configuración.`],
      ['Facturación', `Las suscripciones se facturan mediante Stripe y se renuevan automáticamente salvo cancelación. La cancelación detiene renovaciones futuras y el acceso puede continuar hasta terminar el período actual. Los cargos anteriores no se reembolsan salvo que la ley lo exija.`],
      ['Uso aceptable', `No puedes usar indebidamente la plataforma, intentar accesos no autorizados, cargar contenido malicioso ni usar EverittOS en contra de la ley, derechos de privacidad, contratos o derechos de terceros.`],
      ['Cambios', `Los planes, límites, funciones y estos Términos pueden cambiar con aviso razonable. Seguir usando el servicio después de un cambio importante significa que aceptas los Términos actualizados.`],
      ['Aviso legal', `EverittOS se proporciona “tal cual” en la medida permitida por la ley. No garantizamos un servicio ininterrumpido y la responsabilidad se limita según lo permitido por la ley.`],
      ['Contacto', `Para preguntas de facturación o cuenta, contacta a ${SUPPORT_EMAIL}.`]
    ]
  },
  vi: {
    title: 'Điều khoản dịch vụ', version: 'Phiên bản', updated: 'Cập nhật lần cuối: tháng 9 năm 2026', back: 'Quay lại đăng nhập',
    sections: [
      ['Thỏa thuận', `Khi tạo tài khoản hoặc sử dụng EverittOS, bạn đồng ý với Điều khoản này và Chính sách quyền riêng tư của chúng tôi. Nếu bạn dùng EverittOS thay mặt doanh nghiệp, bạn xác nhận rằng mình có thẩm quyền ràng buộc tổ chức đó.`],
      ['Dịch vụ', `EverittOS được cung cấp cho hoạt động kinh doanh và tài liệu hiện trường. Bạn chịu trách nhiệm đối với thông tin được tải lên, lưu trữ, nhập, xuất, chia sẻ hoặc quản lý trong không gian làm việc và việc tuân thủ luật áp dụng cho doanh nghiệp của mình.`],
      ['Vai trò và quyền trong không gian làm việc', `Chủ sở hữu và quản trị viên chịu trách nhiệm về lời mời, vai trò, quyền truy cập, xem lại hoạt động và xóa quyền khi không còn cần thiết. Nhân viên, nhà thầu, người xem và khách hàng được truy cập theo vai trò, phân công hoặc chia sẻ rõ ràng.`],
      ['Xuất dữ liệu, báo cáo và tệp cổng thông tin', `Người dùng được ủy quyền có thể tạo, tải xuống hoặc chia sẻ báo cáo, bảng tính, hóa đơn, biên lai, ảnh, tài liệu, tin nhắn, phê duyệt và các tệp vận hành khác. Tổ chức chịu trách nhiệm xem lại dữ liệu trước khi phân phối.`],
      ['Kế toán và đồng bộ bên thứ ba', `EverittOS không phải phần mềm kế toán, thuế, bảng lương, đối soát hay tư vấn tài chính. Mọi đồng bộ hoặc xuất dữ liệu kế toán đều do người dùng kiểm soát và bạn chịu trách nhiệm xem lại dữ liệu gửi đến hoặc nhận từ nền tảng bên thứ ba.`],
      ['Tài khoản', `Bạn phải cung cấp thông tin chính xác và bảo vệ thông tin đăng nhập, thiết bị, mật khẩu, passkey và phương thức xác thực. Bạn có thể vô hiệu hóa hoặc xóa tài khoản trong Cài đặt.`],
      ['Thanh toán', `Gói đăng ký được tính phí qua Stripe và tự động gia hạn nếu không hủy. Việc hủy sẽ dừng gia hạn trong tương lai và quyền truy cập có thể tiếp tục đến hết kỳ hiện tại. Các khoản phí trước đó không được hoàn lại trừ khi pháp luật yêu cầu.`],
      ['Sử dụng được phép', `Bạn không được lạm dụng nền tảng, cố truy cập trái phép, tải nội dung độc hại hoặc sử dụng EverittOS trái luật, quyền riêng tư, hợp đồng hoặc quyền của bên thứ ba.`],
      ['Thay đổi', `Gói, giới hạn, tính năng và Điều khoản này có thể thay đổi với thông báo hợp lý. Việc tiếp tục sử dụng sau thay đổi quan trọng đồng nghĩa với việc bạn chấp nhận Điều khoản cập nhật.`],
      ['Tuyên bố miễn trừ', `EverittOS được cung cấp “nguyên trạng” trong phạm vi pháp luật cho phép. Chúng tôi không bảo đảm dịch vụ không gián đoạn và trách nhiệm được giới hạn theo luật hiện hành.`],
      ['Liên hệ', `Nếu có câu hỏi về thanh toán hoặc tài khoản, hãy liên hệ ${SUPPORT_EMAIL}.`]
    ]
  }
} as const;

export default function TermsPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  return (
    <main className="section eo-document">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>{c.title}</h2>
        <p className="muted">{c.version} {TERMS_VERSION} · {c.updated}</p>
        {c.sections.map(([heading, body]) => (
          <section key={heading}>
            <h3>{heading}</h3>
            <p>{body}</p>
          </section>
        ))}
        <p><Link href="/privacy">{locale === 'es' ? 'Política de privacidad' : locale === 'vi' ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}</Link></p>
        <LegalNotice />
        <Link className="btn" href="/login">{c.back}</Link>
      </div>
    </main>
  );
}
