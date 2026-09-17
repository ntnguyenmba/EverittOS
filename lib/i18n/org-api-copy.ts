import type { Locale } from '@/lib/i18n/config';

const COPY: Record<Locale, {
  unauthorized:string;
  serverUnavailable:string;
  companyName:string;
  createCompany:string;
  resolveCompany:string;
  organizationIdRequired:string;
  switchWorkspace:string;
  notMember:string;
}> = {
  en:{unauthorized:'Unauthorized.',serverUnavailable:'This feature is temporarily unavailable.',companyName:'Enter a company name.',createCompany:'Could not create company.',resolveCompany:'Could not resolve company.',organizationIdRequired:'Organization ID is required.',switchWorkspace:'Unable to switch workspace.',notMember:'You are not a member of this organization.'},
  es:{unauthorized:'No autorizado.',serverUnavailable:'Esta función no está disponible temporalmente.',companyName:'Ingresa el nombre de la empresa.',createCompany:'No se pudo crear la empresa.',resolveCompany:'No se pudo identificar la empresa.',organizationIdRequired:'El ID de la organización es obligatorio.',switchWorkspace:'No se pudo cambiar de espacio de trabajo.',notMember:'No eres miembro de esta organización.'},
  vi:{unauthorized:'Không được phép.',serverUnavailable:'Tính năng này tạm thời không khả dụng.',companyName:'Nhập tên công ty.',createCompany:'Không thể tạo công ty.',resolveCompany:'Không thể xác định công ty.',organizationIdRequired:'ID tổ chức là bắt buộc.',switchWorkspace:'Không thể chuyển không gian làm việc.',notMember:'Bạn không phải là thành viên của tổ chức này.'}
};

export function getOrgApiCopy(locale: Locale) { return COPY[locale] || COPY.en; }
