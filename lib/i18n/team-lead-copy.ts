import type { Locale } from '@/lib/i18n/config';
import type { LeadSourceValue } from '@/lib/lead-sources';

export type TeamPageCopy = {
  title:string; subtitle:string; createTeam:string; teamName:string; description:string; colorOptional:string; saving:string; managersOnly:string; activeTeams:string; loadingTeams:string; noTeams:string; noDescription:string; active:string; inactive:string; loadError:string; createError:string; created:string;
};
export type LeadFormCopy = {
  nameRequired:string; saveError:string; savedOpenError:string; details:string; name:string; email:string; phone:string; address:string; assignTo:string; unassigned:string; source:string; notes:string; save:string; saving:string;
};

const TEAM:Record<Locale,TeamPageCopy>={
 en:{title:'Teams',subtitle:'Create departments and crews such as Office, Sales, Exterior Crew, Interior Crew, Estimating, or Subcontractors.',createTeam:'Create team',teamName:'Team name',description:'Description',colorOptional:'Color label, optional',saving:'Saving...',managersOnly:'Only owners, admins, and managers can create or manage teams.',activeTeams:'Active teams',loadingTeams:'Loading teams...',noTeams:'No teams yet.',noDescription:'No description',active:'Active',inactive:'Inactive',loadError:'Unable to load teams.',createError:'Unable to create team.',created:'Team created.'},
 es:{title:'Equipos',subtitle:'Crea departamentos y cuadrillas como Oficina, Ventas, Equipo exterior, Equipo interior, Estimación o Subcontratistas.',createTeam:'Crear equipo',teamName:'Nombre del equipo',description:'Descripción',colorOptional:'Etiqueta de color, opcional',saving:'Guardando...',managersOnly:'Solo propietarios, administradores y gerentes pueden crear o administrar equipos.',activeTeams:'Equipos activos',loadingTeams:'Cargando equipos...',noTeams:'Aún no hay equipos.',noDescription:'Sin descripción',active:'Activo',inactive:'Inactivo',loadError:'No se pudieron cargar los equipos.',createError:'No se pudo crear el equipo.',created:'Equipo creado.'},
 vi:{title:'Nhóm',subtitle:'Tạo phòng ban và đội như Văn phòng, Bán hàng, Đội ngoài trời, Đội trong nhà, Ước tính hoặc Nhà thầu phụ.',createTeam:'Tạo nhóm',teamName:'Tên nhóm',description:'Mô tả',colorOptional:'Nhãn màu, không bắt buộc',saving:'Đang lưu...',managersOnly:'Chỉ chủ sở hữu, quản trị viên và quản lý mới có thể tạo hoặc quản lý nhóm.',activeTeams:'Nhóm đang hoạt động',loadingTeams:'Đang tải nhóm...',noTeams:'Chưa có nhóm.',noDescription:'Không có mô tả',active:'Đang hoạt động',inactive:'Không hoạt động',loadError:'Không thể tải nhóm.',createError:'Không thể tạo nhóm.',created:'Đã tạo nhóm.'}
};

const LEAD:Record<Locale,LeadFormCopy>={
 en:{nameRequired:'Name is required.',saveError:'Unable to save request.',savedOpenError:'Request saved but could not be opened. Refresh and try again.',details:'Request details',name:'Name *',email:'Email',phone:'Phone',address:'Address',assignTo:'Assign to',unassigned:'Unassigned',source:'How they found you',notes:'Notes',save:'Save request',saving:'Saving...'},
 es:{nameRequired:'El nombre es obligatorio.',saveError:'No se pudo guardar la solicitud.',savedOpenError:'La solicitud se guardó, pero no se pudo abrir. Actualiza e inténtalo de nuevo.',details:'Detalles de la solicitud',name:'Nombre *',email:'Correo electrónico',phone:'Teléfono',address:'Dirección',assignTo:'Asignar a',unassigned:'Sin asignar',source:'Cómo te encontraron',notes:'Notas',save:'Guardar solicitud',saving:'Guardando...'},
 vi:{nameRequired:'Tên là bắt buộc.',saveError:'Không thể lưu yêu cầu.',savedOpenError:'Đã lưu yêu cầu nhưng không thể mở. Hãy làm mới và thử lại.',details:'Chi tiết yêu cầu',name:'Tên *',email:'Email',phone:'Điện thoại',address:'Địa chỉ',assignTo:'Phân công cho',unassigned:'Chưa phân công',source:'Họ biết đến bạn bằng cách nào',notes:'Ghi chú',save:'Lưu yêu cầu',saving:'Đang lưu...'}
};

const SOURCES:Record<Locale,Record<LeadSourceValue,string>>={
 en:{website:'Website',phone_call:'Phone Call',facebook:'Facebook',instagram:'Instagram',google_search:'Google Search',google_business_profile:'Google Business Profile',referral:'Referral',repeat_customer:'Repeat Customer',yelp:'Yelp',thumbtack:'Thumbtack',angi:'Angi',homeadvisor:'HomeAdvisor',door_hanger:'Door Hanger',yard_sign:'Yard Sign',vehicle_wrap:'Vehicle Wrap',walk_in:'Walk In',other:'Other'},
 es:{website:'Sitio web',phone_call:'Llamada telefónica',facebook:'Facebook',instagram:'Instagram',google_search:'Búsqueda de Google',google_business_profile:'Perfil de Empresa de Google',referral:'Recomendación',repeat_customer:'Cliente recurrente',yelp:'Yelp',thumbtack:'Thumbtack',angi:'Angi',homeadvisor:'HomeAdvisor',door_hanger:'Colgante de puerta',yard_sign:'Letrero de jardín',vehicle_wrap:'Rotulación de vehículo',walk_in:'Visita sin cita',other:'Otro'},
 vi:{website:'Trang web',phone_call:'Cuộc gọi',facebook:'Facebook',instagram:'Instagram',google_search:'Tìm kiếm Google',google_business_profile:'Hồ sơ doanh nghiệp Google',referral:'Giới thiệu',repeat_customer:'Khách hàng quay lại',yelp:'Yelp',thumbtack:'Thumbtack',angi:'Angi',homeadvisor:'HomeAdvisor',door_hanger:'Tờ treo cửa',yard_sign:'Biển sân',vehicle_wrap:'Dán quảng cáo xe',walk_in:'Khách ghé trực tiếp',other:'Khác'}
};

export function getTeamPageCopy(locale:Locale){return TEAM[locale]||TEAM.en;}
export function getLeadFormCopy(locale:Locale){return LEAD[locale]||LEAD.en;}
export function leadSourceLabelForLocale(value:LeadSourceValue,locale:Locale){return (SOURCES[locale]||SOURCES.en)[value];}
