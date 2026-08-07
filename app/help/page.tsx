'use client';

import Link from 'next/link';
import { useTranslation } from '@/components/locale-provider';

const copy = {
  en: {
    eyebrow: 'EverittOS Help Center',
    title: 'Guidance for setting up and running your company.',
    subtitle: 'Find the main setup steps, everyday workflows, connected tools, and account controls in one place.',
    startSetup: 'Start setup guide',
    signIn: 'Sign in',
    checklistTitle: 'Company setup checklist',
    sections: [
      {
        title: 'Getting started',
        body: 'Set up your company, add customers, create your first job, and invite your team when you are ready.',
        href: '/onboarding'
      },
      {
        title: 'Daily operations',
        body: 'Manage jobs, schedules, photos, reports, customers, messages, and invoices in one place.',
        href: '/dashboard'
      },
      {
        title: 'Integrations',
        body: 'Connect Google Calendar and QuickBooks, then review which information stays updated automatically.',
        href: '/docs/integrations'
      },
      {
        title: 'Team and security',
        body: 'Review roles, permissions, account security, billing controls, and options for larger teams.',
        href: '/settings/enterprise'
      }
    ],
    setupChecks: [
      'Add at least one customer and one job.',
      'Connect Google Calendar when your team uses scheduled field work.',
      'Upload before and after photos to preview a customer report.',
      'Review each team member role before sending invitations.',
      'Confirm your business details, billing plan, and support contact information.'
    ]
  },
  es: {
    eyebrow: 'Centro de ayuda de EverittOS',
    title: 'Orientación para configurar y operar su empresa.',
    subtitle: 'Encuentre los pasos principales de configuración, flujos diarios, herramientas conectadas y controles de cuenta en un solo lugar.',
    startSetup: 'Iniciar guía de configuración',
    signIn: 'Iniciar sesión',
    checklistTitle: 'Lista de configuración de la empresa',
    sections: [
      {
        title: 'Primeros pasos',
        body: 'Configure su empresa, agregue clientes, cree su primer trabajo e invite a su equipo cuando esté listo.',
        href: '/onboarding'
      },
      {
        title: 'Operaciones diarias',
        body: 'Administre trabajos, horarios, fotos, informes, clientes, mensajes y facturas en un solo lugar.',
        href: '/dashboard'
      },
      {
        title: 'Integraciones',
        body: 'Conecte Google Calendar y QuickBooks, y revise qué información se actualiza automáticamente.',
        href: '/docs/integrations'
      },
      {
        title: 'Equipo y seguridad',
        body: 'Revise roles, permisos, seguridad de la cuenta, controles de facturación y opciones para equipos más grandes.',
        href: '/settings/enterprise'
      }
    ],
    setupChecks: [
      'Agregue al menos un cliente y un trabajo.',
      'Conecte Google Calendar cuando su equipo use trabajo de campo programado.',
      'Suba fotos de antes y después para previsualizar un informe al cliente.',
      'Revise el rol de cada miembro del equipo antes de enviar invitaciones.',
      'Confirme los datos del negocio, el plan de facturación y la información de contacto de soporte.'
    ]
  },
  vi: {
    eyebrow: 'Trung tâm trợ giúp EverittOS',
    title: 'Hướng dẫn thiết lập và vận hành công ty của bạn.',
    subtitle: 'Tìm các bước thiết lập chính, quy trình hàng ngày, công cụ kết nối và điều khiển tài khoản ở một nơi.',
    startSetup: 'Bắt đầu hướng dẫn thiết lập',
    signIn: 'Đăng nhập',
    checklistTitle: 'Danh sách thiết lập công ty',
    sections: [
      {
        title: 'Bắt đầu',
        body: 'Thiết lập công ty, thêm khách hàng, tạo công việc đầu tiên và mời nhóm khi bạn sẵn sàng.',
        href: '/onboarding'
      },
      {
        title: 'Vận hành hàng ngày',
        body: 'Quản lý công việc, lịch, ảnh, báo cáo, khách hàng, tin nhắn và hóa đơn ở một nơi.',
        href: '/dashboard'
      },
      {
        title: 'Tích hợp',
        body: 'Kết nối Google Calendar và QuickBooks, rồi xem thông tin nào được cập nhật tự động.',
        href: '/docs/integrations'
      },
      {
        title: 'Nhóm và bảo mật',
        body: 'Xem lại vai trò, quyền, bảo mật tài khoản, kiểm soát thanh toán và tùy chọn cho nhóm lớn hơn.',
        href: '/settings/enterprise'
      }
    ],
    setupChecks: [
      'Thêm ít nhất một khách hàng và một công việc.',
      'Kết nối Google Calendar khi nhóm của bạn dùng công việc hiện trường theo lịch.',
      'Tải ảnh trước và sau để xem trước báo cáo khách hàng.',
      'Xem lại vai trò từng thành viên trước khi gửi lời mời.',
      'Xác nhận chi tiết doanh nghiệp, gói thanh toán và thông tin liên hệ hỗ trợ.'
    ]
  }
} as const;

export default function HelpCenterPage() {
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;

  return (
    <main className="section">
      <div className="container">
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className="muted">{c.subtitle}</p>
          <div className="settings-actions" style={{ marginTop: 18 }}>
            <Link className="btn btn-primary" href="/onboarding">
              {c.startSetup}
            </Link>
            <Link className="btn" href="/login">
              {c.signIn}
            </Link>
          </div>
        </div>

        <div className="settings-grid">
          {c.sections.map((section) => (
            <Link key={section.title} className="settings-card" href={section.href}>
              <h3>{section.title}</h3>
              <p className="muted">{section.body}</p>
            </Link>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>{c.checklistTitle}</h2>
          <ul>
            {c.setupChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
