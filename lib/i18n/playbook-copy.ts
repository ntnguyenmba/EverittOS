import type { Locale } from '@/lib/i18n/config';

export type PlaybookDocumentType = 'policy' | 'sop' | 'instruction';
export type PlaybookTrade = 'cleaning' | 'junk_removal' | 'painting' | 'landscaping' | 'handyman' | 'moving' | 'general';

export type PlaybookStarterBlock = {
  title: string;
  body: string;
};

type PlaybookCopy = {
  navLabel: string;
  title: string;
  description: string;
  createTitle: string;
  createHelp: string;
  chooseTrade: string;
  chooseTradeHelp: string;
  buildFromStarter: string;
  buildFromStarterHelp: string;
  addBlock: string;
  blockTitle: string;
  blockBody: string;
  moveUp: string;
  moveDown: string;
  removeBlock: string;
  dragHint: string;
  assignTitle: string;
  assignHelp: string;
  assignEveryone: string;
  assignedToYou: string;
  share: string;
  shareEmail: string;
  shareCopy: string;
  shared: string;
  copied: string;
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
  trades: Record<PlaybookTrade, string>;
  starterTitles: Record<PlaybookDocumentType, string>;
  starterBodies: Record<PlaybookDocumentType, string>;
  tradeStarters: Record<PlaybookTrade, PlaybookStarterBlock[]>;
};

const COPY: Record<Locale, PlaybookCopy> = {
  en: {
    navLabel: 'Playbook',
    title: 'Playbook',
    description: 'Build simple work instructions your team can follow in the field.',
    createTitle: 'Build a Playbook item',
    createHelp: 'Pick your type of business, start with ready-made blocks, then change only what you need.',
    chooseTrade: 'What kind of work do you do?',
    chooseTradeHelp: 'Choose the closest fit. You can change every block before saving.',
    buildFromStarter: 'Start with these blocks',
    buildFromStarterHelp: 'Move the blocks into the order your team should follow. On phones, use the up and down buttons.',
    addBlock: 'Add block',
    blockTitle: 'Block title',
    blockBody: 'What should the worker do?',
    moveUp: 'Move up',
    moveDown: 'Move down',
    removeBlock: 'Remove',
    dragHint: 'Drag to reorder on desktop.',
    assignTitle: 'Who should see this?',
    assignHelp: 'Assign it to the workers who need it. They will only see Playbook items assigned to them.',
    assignEveryone: 'Everyone on the team',
    assignedToYou: 'Assigned to you',
    share: 'Share',
    shareEmail: 'Email',
    shareCopy: 'Copy',
    shared: 'Share options opened.',
    copied: 'Copied.',
    typeLabel: 'Type',
    titleLabel: 'Title',
    titlePlaceholder: 'Example: End-of-job checklist',
    bodyLabel: 'Instructions',
    bodyPlaceholder: 'Write the policy, steps, or instructions here...',
    save: 'Save Playbook item',
    saving: 'Saving...',
    update: 'Save changes',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    deleteConfirm: 'Delete this Playbook item?',
    loading: 'Loading...',
    emptyTitle: 'Nothing assigned yet',
    emptyBody: 'Create a Playbook item or assign one to a worker so the right instructions are easy to find.',
    saved: 'Saved.',
    deleted: 'Deleted.',
    loadError: 'Playbook items could not be loaded.',
    saveError: 'This Playbook item could not be saved.',
    deleteError: 'This Playbook item could not be deleted.',
    requiredError: 'Add a title and at least one instruction block before saving.',
    starterLabel: 'Need a quick start?',
    starterAction: 'Use starter',
    types: { policy: 'Policy', sop: 'SOP', instruction: 'Work instruction' },
    trades: {
      cleaning: 'Cleaning',
      junk_removal: 'Junk removal',
      painting: 'Painting',
      landscaping: 'Landscaping',
      handyman: 'Handyman / repairs',
      moving: 'Moving',
      general: 'Other field service'
    },
    starterTitles: {
      policy: 'Customer service policy',
      sop: 'Job completion SOP',
      instruction: 'Team arrival instructions'
    },
    starterBodies: {
      policy: 'Purpose\nSet a clear standard for how we serve customers.\n\nPolicy\n1. Be professional and respectful.\n2. Confirm changes before doing extra work.\n3. Protect customer property.\n4. Report complaints or damage right away.',
      sop: '1. Confirm the assigned work is complete.\n2. Check for missed items.\n3. Take required photos.\n4. Clean the work area.\n5. Update the job status and notes.',
      instruction: '1. Review the job details before leaving.\n2. Bring the required supplies.\n3. Arrive in the scheduled window.\n4. Follow access instructions.\n5. Contact a manager if anything is unclear.'
    },
    tradeStarters: {
      cleaning: [
        { title: 'Before arrival', body: 'Review the customer notes, access details, rooms, add-ons, and supplies needed.' },
        { title: 'Walk-through', body: 'Check the property before starting and note damage, problem areas, or special requests.' },
        { title: 'Clean in order', body: 'Work room by room using the company checklist so nothing is skipped.' },
        { title: 'Quality check', body: 'Recheck bathrooms, kitchen, floors, trash, surfaces, and any customer priorities.' },
        { title: 'Finish the job', body: 'Take required photos, secure the property, update the job, and report issues.' }
      ],
      junk_removal: [
        { title: 'Confirm the load', body: 'Review what is approved for removal and confirm anything that should stay.' },
        { title: 'Protect the property', body: 'Plan the carry path and protect walls, floors, doors, and landscaping.' },
        { title: 'Load safely', body: 'Lift safely, keep the truck balanced, and separate items that need special disposal.' },
        { title: 'Final sweep', body: 'Remove loose debris and leave the work area clean.' },
        { title: 'Close out', body: 'Take photos, confirm completion, and note disposal or extra-load issues.' }
      ],
      painting: [
        { title: 'Confirm scope', body: 'Review rooms, surfaces, colors, finish, repairs, and what is not included.' },
        { title: 'Prep', body: 'Protect floors and furniture, patch approved areas, sand, clean, and mask.' },
        { title: 'Paint', body: 'Apply the specified primer and coats with clean cut lines and even coverage.' },
        { title: 'Quality check', body: 'Check coverage, drips, edges, touch-ups, fixtures, and clean lines.' },
        { title: 'Clean up', body: 'Remove protection, clean the area, take photos, and update the job.' }
      ],
      landscaping: [
        { title: 'Review property', body: 'Confirm service areas, gates, pets, irrigation, customer notes, and hazards.' },
        { title: 'Complete service', body: 'Follow the assigned mowing, edging, trimming, cleanup, or treatment scope.' },
        { title: 'Protect property', body: 'Avoid vehicles, windows, irrigation heads, plants, and customer belongings.' },
        { title: 'Final cleanup', body: 'Blow off hard surfaces and remove approved green waste.' },
        { title: 'Close out', body: 'Take required photos and report damage, irrigation issues, or follow-up work.' }
      ],
      handyman: [
        { title: 'Confirm repair', body: 'Review the requested work, parts, access, and approved scope before starting.' },
        { title: 'Inspect first', body: 'Check the area and stop if the condition requires work outside the approved scope.' },
        { title: 'Complete work', body: 'Perform the repair using the correct tools, materials, and safe work practices.' },
        { title: 'Test', body: 'Test the repair and confirm the area is safe and working as expected.' },
        { title: 'Close out', body: 'Clean the area, take photos, and note parts or follow-up work.' }
      ],
      moving: [
        { title: 'Before loading', body: 'Review inventory, fragile items, access, stairs, parking, and special instructions.' },
        { title: 'Protect items', body: 'Wrap and protect furniture, floors, doors, and fragile items before moving.' },
        { title: 'Load in order', body: 'Load safely, protect the truck, and secure items to prevent shifting.' },
        { title: 'Unload and place', body: 'Place items where requested and check for damage before leaving.' },
        { title: 'Close out', body: 'Remove packing debris, take required photos, and report issues.' }
      ],
      general: [
        { title: 'Before arrival', body: 'Review the job scope, customer notes, access, tools, and supplies.' },
        { title: 'Before starting', body: 'Confirm the work area and report anything outside the approved scope.' },
        { title: 'Do the work', body: 'Follow the company process and complete the assigned work safely.' },
        { title: 'Check the work', body: 'Review the result and correct missed items before leaving.' },
        { title: 'Close out', body: 'Clean the area, take required photos, update the job, and report issues.' }
      ]
    }
  },
  es: {
    navLabel: 'Manual',
    title: 'Manual',
    description: 'Cree instrucciones simples para que su equipo las siga en el trabajo.',
    createTitle: 'Crear una guía de trabajo',
    createHelp: 'Elija su tipo de negocio, empiece con bloques listos y cambie solo lo necesario.',
    chooseTrade: '¿Qué tipo de trabajo hace?',
    chooseTradeHelp: 'Elija la opción más parecida. Puede cambiar todos los bloques antes de guardar.',
    buildFromStarter: 'Empiece con estos bloques',
    buildFromStarterHelp: 'Ponga los bloques en el orden que debe seguir el equipo. En el teléfono use los botones de subir y bajar.',
    addBlock: 'Agregar bloque',
    blockTitle: 'Título del bloque',
    blockBody: '¿Qué debe hacer el trabajador?',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    removeBlock: 'Eliminar',
    dragHint: 'Arrastre para cambiar el orden en computadora.',
    assignTitle: '¿Quién debe verlo?',
    assignHelp: 'Asígnelo a los trabajadores que lo necesitan. Solo verán los elementos asignados a ellos.',
    assignEveryone: 'Todo el equipo',
    assignedToYou: 'Asignado a usted',
    share: 'Compartir',
    shareEmail: 'Correo',
    shareCopy: 'Copiar',
    shared: 'Se abrieron las opciones para compartir.',
    copied: 'Copiado.',
    typeLabel: 'Tipo',
    titleLabel: 'Título',
    titlePlaceholder: 'Ejemplo: Lista para terminar el trabajo',
    bodyLabel: 'Instrucciones',
    bodyPlaceholder: 'Escriba aquí la política, los pasos o las instrucciones...',
    save: 'Guardar en el manual',
    saving: 'Guardando...',
    update: 'Guardar cambios',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    deleteConfirm: '¿Eliminar este elemento del manual?',
    loading: 'Cargando...',
    emptyTitle: 'No hay nada asignado todavía',
    emptyBody: 'Cree un elemento o asígnelo a un trabajador para que las instrucciones correctas sean fáciles de encontrar.',
    saved: 'Guardado.',
    deleted: 'Eliminado.',
    loadError: 'No se pudieron cargar los elementos.',
    saveError: 'No se pudo guardar este elemento.',
    deleteError: 'No se pudo eliminar este elemento.',
    requiredError: 'Agregue un título y al menos un bloque de instrucciones.',
    starterLabel: '¿Quiere empezar rápido?',
    starterAction: 'Usar ejemplo',
    types: { policy: 'Política', sop: 'Procedimiento', instruction: 'Instrucción de trabajo' },
    trades: {
      cleaning: 'Limpieza', junk_removal: 'Retiro de basura', painting: 'Pintura', landscaping: 'Jardinería', handyman: 'Reparaciones', moving: 'Mudanzas', general: 'Otro servicio de campo'
    },
    starterTitles: { policy: 'Política de atención al cliente', sop: 'Procedimiento para terminar un trabajo', instruction: 'Instrucciones de llegada' },
    starterBodies: {
      policy: '1. Sea profesional y respetuoso.\n2. Confirme cambios antes de hacer trabajo adicional.\n3. Proteja la propiedad del cliente.\n4. Informe quejas o daños de inmediato.',
      sop: '1. Confirme que el trabajo esté completo.\n2. Revise lo que pudo faltar.\n3. Tome las fotos requeridas.\n4. Limpie el área.\n5. Actualice el trabajo y las notas.',
      instruction: '1. Revise el trabajo antes de salir.\n2. Lleve los materiales necesarios.\n3. Llegue dentro del horario.\n4. Siga las instrucciones de acceso.\n5. Llame al gerente si algo no está claro.'
    },
    tradeStarters: {
      cleaning: [
        { title: 'Antes de llegar', body: 'Revise notas del cliente, acceso, cuartos, extras y materiales necesarios.' },
        { title: 'Revisión inicial', body: 'Revise la propiedad y anote daños, áreas difíciles o pedidos especiales.' },
        { title: 'Limpiar en orden', body: 'Trabaje cuarto por cuarto usando la lista de la empresa.' },
        { title: 'Control de calidad', body: 'Revise baños, cocina, pisos, basura, superficies y prioridades del cliente.' },
        { title: 'Terminar', body: 'Tome fotos, asegure la propiedad, actualice el trabajo e informe problemas.' }
      ],
      junk_removal: [
        { title: 'Confirmar la carga', body: 'Revise lo aprobado para retirar y confirme lo que debe quedarse.' },
        { title: 'Proteger la propiedad', body: 'Planee la ruta y proteja paredes, pisos, puertas y jardines.' },
        { title: 'Cargar con seguridad', body: 'Levante con cuidado, mantenga el camión balanceado y separe residuos especiales.' },
        { title: 'Limpieza final', body: 'Retire residuos sueltos y deje limpia el área.' },
        { title: 'Cerrar el trabajo', body: 'Tome fotos y anote problemas de carga o disposición.' }
      ],
      painting: [
        { title: 'Confirmar alcance', body: 'Revise cuartos, superficies, colores, acabado, reparaciones y exclusiones.' },
        { title: 'Preparar', body: 'Proteja pisos y muebles, repare áreas aprobadas, lije, limpie y cubra.' },
        { title: 'Pintar', body: 'Aplique primer y capas indicadas con líneas limpias y cobertura uniforme.' },
        { title: 'Control de calidad', body: 'Revise cobertura, goteos, bordes, retoques y líneas.' },
        { title: 'Limpiar', body: 'Retire protecciones, limpie el área, tome fotos y actualice el trabajo.' }
      ],
      landscaping: [
        { title: 'Revisar propiedad', body: 'Confirme áreas, puertas, mascotas, riego, notas y riesgos.' },
        { title: 'Completar servicio', body: 'Siga el alcance asignado de corte, bordes, poda, limpieza o tratamiento.' },
        { title: 'Proteger propiedad', body: 'Evite vehículos, ventanas, riego, plantas y objetos del cliente.' },
        { title: 'Limpieza final', body: 'Limpie superficies duras y retire residuos verdes aprobados.' },
        { title: 'Cerrar', body: 'Tome fotos e informe daños, riego o trabajo de seguimiento.' }
      ],
      handyman: [
        { title: 'Confirmar reparación', body: 'Revise trabajo, piezas, acceso y alcance aprobado.' },
        { title: 'Inspeccionar primero', body: 'Revise el área y deténgase si el trabajo supera el alcance aprobado.' },
        { title: 'Completar trabajo', body: 'Haga la reparación con herramientas, materiales y prácticas seguras.' },
        { title: 'Probar', body: 'Pruebe la reparación y confirme que funcione correctamente.' },
        { title: 'Cerrar', body: 'Limpie, tome fotos y anote piezas o seguimiento.' }
      ],
      moving: [
        { title: 'Antes de cargar', body: 'Revise inventario, objetos frágiles, acceso, escaleras, estacionamiento e instrucciones.' },
        { title: 'Proteger objetos', body: 'Proteja muebles, pisos, puertas y objetos frágiles.' },
        { title: 'Cargar en orden', body: 'Cargue con seguridad y asegure los objetos para evitar movimiento.' },
        { title: 'Descargar', body: 'Coloque los objetos donde se indique y revise daños.' },
        { title: 'Cerrar', body: 'Retire residuos, tome fotos e informe problemas.' }
      ],
      general: [
        { title: 'Antes de llegar', body: 'Revise alcance, notas, acceso, herramientas y materiales.' },
        { title: 'Antes de empezar', body: 'Confirme el área e informe cualquier trabajo fuera del alcance.' },
        { title: 'Hacer el trabajo', body: 'Siga el proceso de la empresa y trabaje con seguridad.' },
        { title: 'Revisar', body: 'Revise el resultado y corrija lo que falte.' },
        { title: 'Cerrar', body: 'Limpie, tome fotos, actualice el trabajo e informe problemas.' }
      ]
    }
  },
  vi: {
    navLabel: 'Sổ tay',
    title: 'Sổ tay',
    description: 'Tạo hướng dẫn công việc đơn giản để đội ngũ làm theo tại hiện trường.',
    createTitle: 'Tạo hướng dẫn công việc',
    createHelp: 'Chọn loại công việc, dùng các khối có sẵn rồi chỉ sửa phần cần thiết.',
    chooseTrade: 'Bạn làm loại công việc nào?',
    chooseTradeHelp: 'Chọn mục gần nhất. Có thể sửa mọi khối trước khi lưu.',
    buildFromStarter: 'Bắt đầu với các khối này',
    buildFromStarterHelp: 'Sắp xếp theo thứ tự đội ngũ cần làm. Trên điện thoại dùng nút lên và xuống.',
    addBlock: 'Thêm khối',
    blockTitle: 'Tên khối',
    blockBody: 'Người làm cần làm gì?',
    moveUp: 'Lên',
    moveDown: 'Xuống',
    removeBlock: 'Xóa',
    dragHint: 'Kéo để đổi thứ tự trên máy tính.',
    assignTitle: 'Ai cần xem?',
    assignHelp: 'Gán cho người cần dùng. Họ chỉ thấy các mục được gán cho mình.',
    assignEveryone: 'Cả đội',
    assignedToYou: 'Được giao cho bạn',
    share: 'Chia sẻ',
    shareEmail: 'Email',
    shareCopy: 'Sao chép',
    shared: 'Đã mở tùy chọn chia sẻ.',
    copied: 'Đã sao chép.',
    typeLabel: 'Loại',
    titleLabel: 'Tiêu đề',
    titlePlaceholder: 'Ví dụ: Danh sách kết thúc công việc',
    bodyLabel: 'Hướng dẫn',
    bodyPlaceholder: 'Viết chính sách, các bước hoặc hướng dẫn tại đây...',
    save: 'Lưu vào sổ tay',
    saving: 'Đang lưu...',
    update: 'Lưu thay đổi',
    cancel: 'Hủy',
    edit: 'Sửa',
    delete: 'Xóa',
    deleteConfirm: 'Xóa mục này?',
    loading: 'Đang tải...',
    emptyTitle: 'Chưa có gì được giao',
    emptyBody: 'Tạo mục mới hoặc giao cho một người để họ dễ tìm đúng hướng dẫn.',
    saved: 'Đã lưu.',
    deleted: 'Đã xóa.',
    loadError: 'Không tải được các mục.',
    saveError: 'Không lưu được mục này.',
    deleteError: 'Không xóa được mục này.',
    requiredError: 'Thêm tiêu đề và ít nhất một khối hướng dẫn.',
    starterLabel: 'Cần bắt đầu nhanh?',
    starterAction: 'Dùng mẫu',
    types: { policy: 'Chính sách', sop: 'Quy trình', instruction: 'Hướng dẫn công việc' },
    trades: { cleaning: 'Vệ sinh', junk_removal: 'Dọn rác', painting: 'Sơn', landscaping: 'Chăm sóc cảnh quan', handyman: 'Sửa chữa', moving: 'Chuyển nhà', general: 'Dịch vụ hiện trường khác' },
    starterTitles: { policy: 'Chính sách phục vụ khách hàng', sop: 'Quy trình hoàn tất công việc', instruction: 'Hướng dẫn khi đến nơi' },
    starterBodies: {
      policy: '1. Làm việc chuyên nghiệp và tôn trọng.\n2. Xác nhận trước khi làm thêm ngoài phạm vi.\n3. Bảo vệ tài sản khách hàng.\n4. Báo ngay khi có khiếu nại hoặc hư hỏng.',
      sop: '1. Xác nhận công việc đã xong.\n2. Kiểm tra phần còn thiếu.\n3. Chụp ảnh yêu cầu.\n4. Dọn khu vực.\n5. Cập nhật công việc và ghi chú.',
      instruction: '1. Xem chi tiết công việc trước khi đi.\n2. Mang đủ vật tư.\n3. Đến đúng khung giờ.\n4. Làm theo hướng dẫn ra vào.\n5. Liên hệ quản lý nếu chưa rõ.'
    },
    tradeStarters: {
      cleaning: [
        { title: 'Trước khi đến', body: 'Xem ghi chú khách hàng, cách vào, phòng, dịch vụ thêm và vật tư.' },
        { title: 'Kiểm tra ban đầu', body: 'Kiểm tra tài sản và ghi lại hư hỏng, khu vực khó hoặc yêu cầu đặc biệt.' },
        { title: 'Vệ sinh theo thứ tự', body: 'Làm từng phòng theo danh sách của công ty để không bỏ sót.' },
        { title: 'Kiểm tra chất lượng', body: 'Kiểm tra phòng tắm, bếp, sàn, rác, bề mặt và ưu tiên của khách.' },
        { title: 'Kết thúc', body: 'Chụp ảnh, khóa tài sản, cập nhật công việc và báo vấn đề.' }
      ],
      junk_removal: [
        { title: 'Xác nhận đồ cần dọn', body: 'Xem những gì được phép dọn và xác nhận những gì phải để lại.' },
        { title: 'Bảo vệ tài sản', body: 'Lên đường vận chuyển và bảo vệ tường, sàn, cửa và cảnh quan.' },
        { title: 'Xếp hàng an toàn', body: 'Nâng an toàn, cân bằng xe và tách vật liệu cần xử lý đặc biệt.' },
        { title: 'Dọn cuối', body: 'Thu gom mảnh vụn và để khu vực sạch.' },
        { title: 'Kết thúc', body: 'Chụp ảnh và ghi lại vấn đề về tải hoặc xử lý.' }
      ],
      painting: [
        { title: 'Xác nhận phạm vi', body: 'Xem phòng, bề mặt, màu, độ bóng, sửa chữa và phần không bao gồm.' },
        { title: 'Chuẩn bị', body: 'Che sàn và đồ, vá phần được duyệt, chà nhám, lau sạch và che chắn.' },
        { title: 'Sơn', body: 'Sơn lót và các lớp theo yêu cầu với đường nét sạch và phủ đều.' },
        { title: 'Kiểm tra chất lượng', body: 'Kiểm tra độ phủ, chảy sơn, mép, dặm và đường sơn.' },
        { title: 'Dọn dẹp', body: 'Gỡ bảo vệ, dọn khu vực, chụp ảnh và cập nhật công việc.' }
      ],
      landscaping: [
        { title: 'Kiểm tra tài sản', body: 'Xác nhận khu vực, cổng, thú nuôi, tưới, ghi chú và nguy cơ.' },
        { title: 'Hoàn thành dịch vụ', body: 'Làm theo phạm vi cắt cỏ, tỉa mép, tỉa cây, dọn dẹp hoặc xử lý.' },
        { title: 'Bảo vệ tài sản', body: 'Tránh xe, cửa kính, đầu tưới, cây và đồ của khách.' },
        { title: 'Dọn cuối', body: 'Thổi sạch bề mặt cứng và dọn rác xanh được duyệt.' },
        { title: 'Kết thúc', body: 'Chụp ảnh và báo hư hỏng, vấn đề tưới hoặc việc cần làm thêm.' }
      ],
      handyman: [
        { title: 'Xác nhận sửa chữa', body: 'Xem công việc, linh kiện, cách vào và phạm vi được duyệt.' },
        { title: 'Kiểm tra trước', body: 'Kiểm tra khu vực và dừng nếu cần việc ngoài phạm vi.' },
        { title: 'Thực hiện', body: 'Sửa bằng đúng dụng cụ, vật liệu và cách làm an toàn.' },
        { title: 'Thử lại', body: 'Kiểm tra sửa chữa và xác nhận hoạt động đúng.' },
        { title: 'Kết thúc', body: 'Dọn khu vực, chụp ảnh và ghi linh kiện hoặc việc cần theo dõi.' }
      ],
      moving: [
        { title: 'Trước khi chất hàng', body: 'Xem đồ đạc, đồ dễ vỡ, lối vào, cầu thang, chỗ đậu và hướng dẫn.' },
        { title: 'Bảo vệ đồ', body: 'Bọc đồ nội thất, sàn, cửa và đồ dễ vỡ.' },
        { title: 'Chất hàng', body: 'Chất an toàn và cố định để đồ không xê dịch.' },
        { title: 'Dỡ hàng', body: 'Đặt đồ theo yêu cầu và kiểm tra hư hỏng.' },
        { title: 'Kết thúc', body: 'Dọn rác đóng gói, chụp ảnh và báo vấn đề.' }
      ],
      general: [
        { title: 'Trước khi đến', body: 'Xem phạm vi, ghi chú, cách vào, dụng cụ và vật tư.' },
        { title: 'Trước khi bắt đầu', body: 'Xác nhận khu vực và báo việc ngoài phạm vi.' },
        { title: 'Làm công việc', body: 'Theo quy trình công ty và hoàn thành an toàn.' },
        { title: 'Kiểm tra', body: 'Xem lại kết quả và sửa phần còn thiếu.' },
        { title: 'Kết thúc', body: 'Dọn khu vực, chụp ảnh, cập nhật công việc và báo vấn đề.' }
      ]
    }
  }
};

export function getPlaybookCopy(locale: Locale): PlaybookCopy {
  return COPY[locale] || COPY.en;
}
