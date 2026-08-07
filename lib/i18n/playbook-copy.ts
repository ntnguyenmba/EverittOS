import type { Locale } from '@/lib/i18n/config';

export type PlaybookDocumentType = 'policy' | 'sop' | 'instruction';

type PlaybookCopy = {
  navLabel: string;
  title: string;
  description: string;
  createTitle: string;
  createHelp: string;
  typeLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  save: string;
  saving: string;
  update: string;
  cancel: string;
  edit: string;
  delete: string;
  deleteConfirm: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  saved: string;
  deleted: string;
  loadError: string;
  saveError: string;
  deleteError: string;
  requiredError: string;
  starterLabel: string;
  starterAction: string;
  types: Record<PlaybookDocumentType, string>;
  starterTitles: Record<PlaybookDocumentType, string>;
  starterBodies: Record<PlaybookDocumentType, string>;
};

const COPY: Record<Locale, PlaybookCopy> = {
  en: {
    navLabel: 'Business Playbook',
    title: 'Business Playbook',
    description: 'Create and keep the policies, SOPs, and team instructions your business runs on.',
    createTitle: 'Create a playbook item',
    createHelp: 'Choose a type, give it a clear name, and write the steps or rules your team should follow.',
    typeLabel: 'Type',
    titleLabel: 'Title',
    titlePlaceholder: 'Example: Closing checklist',
    bodyLabel: 'Instructions',
    bodyPlaceholder: 'Write the policy, steps, or instructions here...',
    save: 'Save',
    saving: 'Saving...',
    update: 'Save changes',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this playbook item?',
    loading: 'Loading...',
    emptyTitle: 'No playbook items yet',
    emptyBody: 'Start with a policy, SOP, or team instruction so everyone knows how work should be done.',
    saved: 'Saved.',
    deleted: 'Deleted.',
    loadError: 'Playbook items could not be loaded.',
    saveError: 'This playbook item could not be saved.',
    deleteError: 'This playbook item could not be deleted.',
    requiredError: 'Add a title and instructions before saving.',
    starterLabel: 'Need a starting point?',
    starterAction: 'Use this starter',
    types: { policy: 'Policy', sop: 'SOP', instruction: 'Team instruction' },
    starterTitles: {
      policy: 'Customer service policy',
      sop: 'Job completion SOP',
      instruction: 'Team arrival instructions'
    },
    starterBodies: {
      policy: 'Purpose\nSet a clear standard for how we serve customers.\n\nPolicy\n1. Respond professionally and respectfully.\n2. Confirm changes before doing work outside the agreed scope.\n3. Protect customer privacy and property.\n4. Report complaints or damage to a manager promptly.',
      sop: 'Purpose\nUse these steps before closing any job.\n\nSteps\n1. Confirm the assigned work is complete.\n2. Check the work area for missed items.\n3. Take required completion photos.\n4. Clean the work area and remove approved waste.\n5. Update the job status and add any follow-up notes.',
      instruction: 'Before arrival\n1. Review the job details and customer notes.\n2. Confirm you have the required supplies.\n\nAt the property\n1. Arrive within the scheduled window.\n2. Follow access instructions exactly.\n3. Contact a manager if access or job details are unclear.'
    }
  },
  es: {
    navLabel: 'Manual del negocio',
    title: 'Manual del negocio',
    description: 'Cree y guarde las políticas, procedimientos e instrucciones de equipo que usa su negocio.',
    createTitle: 'Crear un elemento del manual',
    createHelp: 'Elija un tipo, póngale un nombre claro y escriba los pasos o reglas que debe seguir su equipo.',
    typeLabel: 'Tipo',
    titleLabel: 'Título',
    titlePlaceholder: 'Ejemplo: Lista de cierre',
    bodyLabel: 'Instrucciones',
    bodyPlaceholder: 'Escriba aquí la política, los pasos o las instrucciones...',
    save: 'Guardar',
    saving: 'Guardando...',
    update: 'Guardar cambios',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    deleteConfirm: '¿Eliminar este elemento del manual?',
    loading: 'Cargando...',
    emptyTitle: 'Aún no hay elementos en el manual',
    emptyBody: 'Comience con una política, un procedimiento o una instrucción para que todos sepan cómo debe hacerse el trabajo.',
    saved: 'Guardado.',
    deleted: 'Eliminado.',
    loadError: 'No se pudieron cargar los elementos del manual.',
    saveError: 'No se pudo guardar este elemento del manual.',
    deleteError: 'No se pudo eliminar este elemento del manual.',
    requiredError: 'Agregue un título e instrucciones antes de guardar.',
    starterLabel: '¿Necesita un punto de partida?',
    starterAction: 'Usar este ejemplo',
    types: { policy: 'Política', sop: 'Procedimiento', instruction: 'Instrucción del equipo' },
    starterTitles: {
      policy: 'Política de atención al cliente',
      sop: 'Procedimiento para cerrar un trabajo',
      instruction: 'Instrucciones de llegada del equipo'
    },
    starterBodies: {
      policy: 'Objetivo\nEstablecer una norma clara sobre cómo atendemos a los clientes.\n\nPolítica\n1. Responder de forma profesional y respetuosa.\n2. Confirmar los cambios antes de realizar trabajo fuera del alcance acordado.\n3. Proteger la privacidad y la propiedad del cliente.\n4. Informar rápidamente a un gerente sobre quejas o daños.',
      sop: 'Objetivo\nUse estos pasos antes de cerrar cualquier trabajo.\n\nPasos\n1. Confirmar que el trabajo asignado esté terminado.\n2. Revisar el área para detectar algo pendiente.\n3. Tomar las fotos finales requeridas.\n4. Limpiar el área y retirar los residuos aprobados.\n5. Actualizar el estado del trabajo y agregar notas de seguimiento.',
      instruction: 'Antes de llegar\n1. Revisar los detalles del trabajo y las notas del cliente.\n2. Confirmar que tiene los suministros necesarios.\n\nEn la propiedad\n1. Llegar dentro del horario programado.\n2. Seguir exactamente las instrucciones de acceso.\n3. Contactar a un gerente si el acceso o los detalles no están claros.'
    }
  },
  vi: {
    navLabel: 'Cẩm nang doanh nghiệp',
    title: 'Cẩm nang doanh nghiệp',
    description: 'Tạo và lưu các chính sách, quy trình và hướng dẫn nhóm mà doanh nghiệp sử dụng hằng ngày.',
    createTitle: 'Tạo nội dung cẩm nang',
    createHelp: 'Chọn loại, đặt tên rõ ràng và viết các bước hoặc quy tắc mà nhóm cần làm theo.',
    typeLabel: 'Loại',
    titleLabel: 'Tiêu đề',
    titlePlaceholder: 'Ví dụ: Danh sách kiểm tra khi kết thúc',
    bodyLabel: 'Hướng dẫn',
    bodyPlaceholder: 'Viết chính sách, các bước hoặc hướng dẫn tại đây...',
    save: 'Lưu',
    saving: 'Đang lưu...',
    update: 'Lưu thay đổi',
    cancel: 'Hủy',
    edit: 'Sửa',
    delete: 'Xóa',
    deleteConfirm: 'Xóa nội dung cẩm nang này?',
    loading: 'Đang tải...',
    emptyTitle: 'Chưa có nội dung trong cẩm nang',
    emptyBody: 'Bắt đầu với một chính sách, quy trình hoặc hướng dẫn để mọi người biết công việc cần được thực hiện như thế nào.',
    saved: 'Đã lưu.',
    deleted: 'Đã xóa.',
    loadError: 'Không tải được nội dung cẩm nang.',
    saveError: 'Không lưu được nội dung này.',
    deleteError: 'Không xóa được nội dung này.',
    requiredError: 'Thêm tiêu đề và hướng dẫn trước khi lưu.',
    starterLabel: 'Cần mẫu để bắt đầu?',
    starterAction: 'Dùng mẫu này',
    types: { policy: 'Chính sách', sop: 'Quy trình', instruction: 'Hướng dẫn nhóm' },
    starterTitles: {
      policy: 'Chính sách chăm sóc khách hàng',
      sop: 'Quy trình hoàn tất công việc',
      instruction: 'Hướng dẫn khi nhóm đến nơi'
    },
    starterBodies: {
      policy: 'Mục đích\nĐặt tiêu chuẩn rõ ràng về cách phục vụ khách hàng.\n\nChính sách\n1. Phản hồi chuyên nghiệp và tôn trọng.\n2. Xác nhận thay đổi trước khi làm việc ngoài phạm vi đã thống nhất.\n3. Bảo vệ quyền riêng tư và tài sản của khách hàng.\n4. Báo nhanh cho quản lý khi có khiếu nại hoặc hư hỏng.',
      sop: 'Mục đích\nDùng các bước này trước khi đóng bất kỳ công việc nào.\n\nCác bước\n1. Xác nhận công việc được giao đã hoàn tất.\n2. Kiểm tra khu vực để tránh bỏ sót.\n3. Chụp ảnh hoàn thành theo yêu cầu.\n4. Dọn khu vực làm việc và bỏ rác được phép.\n5. Cập nhật trạng thái công việc và thêm ghi chú cần theo dõi.',
      instruction: 'Trước khi đến\n1. Xem chi tiết công việc và ghi chú của khách hàng.\n2. Xác nhận đã có đủ vật tư cần thiết.\n\nTại địa điểm\n1. Đến trong khung giờ đã lên lịch.\n2. Làm đúng hướng dẫn ra vào.\n3. Liên hệ quản lý nếu thông tin ra vào hoặc công việc chưa rõ.'
    }
  }
};

export function getPlaybookCopy(locale: Locale): PlaybookCopy {
  return COPY[locale] || COPY.en;
}
