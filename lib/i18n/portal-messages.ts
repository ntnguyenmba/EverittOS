import type { PortalMessages } from '@/lib/i18n/portal-messages-types';

export const portalMessagesEn: PortalMessages = {
  common: {
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    loading: 'Loading…',
    back: 'Back',
    open: 'Open',
    view: 'View',
    account: 'Account',
    overview: 'Overview',
    appointments: 'Appointments',
    sections: 'Portal sections',
    dateNotSet: 'Date not set',
    notSet: 'Not set',
    status: 'Status',
    due: 'Due',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    language: 'Language'
  },
  status: {
    job: {
      new: 'New',
      scheduled: 'Scheduled',
      inProgress: 'In progress',
      waiting: 'Waiting',
      completed: 'Completed',
      cancelled: 'Cancelled',
      unknown: 'Unknown'
    },
    payment: {
      paid: 'Paid',
      unpaid: 'Unpaid',
      partiallyPaid: 'Partially paid',
      pending: 'Pending',
      none: 'None',
      notSet: 'Not set',
      open: 'Open',
      draft: 'Draft',
      unknown: 'Unknown'
    }
  },
  legal: {
    title: 'Legal',
    description: 'Review the policies that apply to your dashboard access.',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    generalDisclaimer: 'General Disclaimer',
    customerDisclaimer: 'Customer Dashboard Disclaimer',
    contractorDisclaimer: 'Worker Disclaimer'
  },
  account: {
    title: 'Account settings',
    description: 'Manage your profile, notifications, legal links, and account deletion.',
    backToOverview: 'Back to overview',
    loading: 'Loading account settings…',
    profile: {
      title: 'Profile',
      description: 'Update the contact details used for job and account notifications.',
      firstName: 'First name',
      lastName: 'Last name',
      displayName: 'Display name',
      phone: 'Phone',
      email: 'Email',
      newEmail: 'New email',
      newPassword: 'New password',
      keepEmail: 'Leave blank to keep current email',
      keepPassword: 'Leave blank to keep current password',
      saveAccount: 'Save account'
    },
    notifications: {
      title: 'Notifications',
      clientDescription: 'Choose which appointment and invoice updates you want by email.',
      contractorDescription: 'Choose which worker updates you want by email.',
      emailNotifications: 'Email notifications',
      clientOperational: 'Appointment and invoice updates',
      contractorOperational: 'Job and payment updates',
      productUpdates: 'Product updates'
    },
    calendar: {
      title: 'Calendar',
      clientDescription:
        'Use Add to Calendar on your appointments for Google, Outlook, or Apple Calendar. This dashboard does not include company integrations.',
      contractorDescription:
        'Use Add to Calendar on an assigned job for a one-time calendar event. Company-wide Google Calendar and QuickBooks connections are managed by the company owner.'
    },
    delete: {
      dangerZone: 'Danger Zone',
      deleteAccount: 'Delete Account',
      deleteMyAccount: 'Delete My Account',
      subscriptionWarning:
        'Deleting your EverittOS account does not automatically cancel an App Store or Google Play subscription. Manage those in Apple Settings or Google Play Subscriptions.',
      activeSubscription: 'Active subscriptions must be cancelled before account deletion.',
      goToBilling: 'Go to Billing',
      askOwnerCancel: 'Ask your company owner to cancel billing, or cancel any store subscription first.',
      confirmTitle: 'Delete Account',
      confirmBody:
        'Are you sure you want to permanently delete your account? This action cannot be undone and you will lose access to your login. Company-owned business records are retained where required.',
      typeToConfirm: 'Type DELETE to confirm',
      cancel: 'Cancel',
      deleting: 'Deleting…',
      permanentlyDelete: 'Permanently Delete Account',
      unableToDelete: 'Unable to delete account.',
      unableToDeleteRetry: 'Unable to delete account. Please try again.',
      clientRetention:
        'Deleting your login removes your dashboard access and personal profile details. Invoices, payments, completed jobs, and other service records stay with your service provider when required.',
      contractorRetention:
        'Deleting your login removes your access and personal profile details. Company job history, customer records, and payment records stay with the hiring company.',
      defaultPortalRetention:
        'Deleting your login removes dashboard access and personal profile details. Company-owned job, invoice, payment, and audit records remain with the service provider when required.',
      defaultOwnerRetention:
        'Permanently delete your account and associated profile information. This action cannot be undone. Deleting your personal EverittOS account does not automatically delete a company you own when other ownership handling is required.'
    }
  },
  client: {
    portal: 'Customer dashboard',
    settingsTitle: 'Account settings',
    settingsDescription: 'Manage your profile, notifications, legal links, and account deletion.',
    yourService: 'Your service',
    loadingPortal: 'Loading your customer dashboard...',
    loadingSharedJobs: 'Loading your shared jobs...',
    sharedJobsTitle: 'Shared jobs',
    sharedJobsDescription: 'Only jobs shared with you are listed here.',
    noSharedTitle: 'No shared jobs yet',
    noSharedMessage:
      'There are currently no shared jobs for your account. When a business shares a job with you, it will appear here.',
    openJob: 'Open job',
    sharedJob: 'Shared job',
    sharedJobDescription: 'View appointment details, reports, and photos shared with you.',
    backToSharedJobs: 'Back to shared jobs',
    appointment: 'Appointment',
    reports: 'Reports',
    noReports: 'No reports have been shared for this job yet.',
    openReport: 'Open report',
    photos: 'Photos',
    invoices: 'Invoices',
    amountPending: 'Amount pending',
    jobTotal: 'Job total',
    paid: 'Paid',
    balanceDue: 'Balance due',
    jobNotFound: 'This shared job could not be found.',
    jobLoadError: 'This shared job could not be loaded. Please try again.',
    growthRequired: 'Customer dashboard requires Growth plan or higher, or a client role.',
    wrongAccountLink: 'This dashboard link belongs to a different client account.',
    tabs: {
      dashboard: 'Overview',
      jobs: 'Appointments',
      schedule: 'Schedule',
      reports: 'Reports & photos',
      invoices: 'Invoices',
      profile: 'Account'
    },
    dashboard: {
      upcomingAppointment: 'Upcoming Appointment',
      noUpcoming: 'No upcoming appointments.',
      jobStatus: 'Job Status',
      noJobsShared: 'No jobs shared yet.',
      invoicesPayments: 'Invoices & Payments',
      noInvoices: 'No invoices yet.',
      invoiceFallback: 'Invoice',
      reportsPhotos: 'Reports & Photos',
      noSharedReports: 'No shared reports yet.',
      viewReportsPhotos: 'View reports & photos'
    },
    schedule: {
      title: 'Schedule',
      viewDetails: 'View details'
    },
    profile: {
      title: 'Your profile',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      business: 'Business',
      notSet: 'Not set',
      linkedCustomers: 'Linked customer records',
      noEmail: 'No email',
      noPhone: 'No phone',
      editAccount: 'Edit account settings',
      customerDisclaimer: 'Customer dashboard disclaimer'
    },
    reportsTab: {
      sharedReports: 'Shared reports',
      noReportsShared: 'No reports have been shared with you.',
      appointmentReport: 'Appointment report',
      photosHeading: 'Photos',
      noAppointments: 'No appointments yet.'
    },
    invoicesTab: {
      title: 'Invoices and payments',
      none: 'You do not have any open invoices.',
      jobLabel: 'Job'
    },
    jobsTab: {
      emptyTitle: 'No shared jobs yet',
      emptyBody:
        'There are currently no shared jobs for your account. When a business shares a job with you, it will appear here.',
      hidePhotos: 'Hide photos',
      viewPhotos: 'View photos',
      noReportsForJob: 'No reports have been shared with you for this job.',
      activityTimeline: 'Activity timeline',
      jobUpdate: 'Job update'
    }
  },
  contractor: {
    portal: 'Worker dashboard',
    accountLabel: 'Worker account',
    settingsTitle: 'Account settings',
    settingsDescription: 'Manage your profile, notifications, legal links, and account deletion.',
    today: 'Today',
    todaysJobs: "Today's Jobs",
    upcomingJobs: 'Upcoming Jobs',
    pastJobs: 'Past Jobs',
    nothingToday: 'Nothing scheduled for today.',
    noUpcoming: 'No upcoming jobs.',
    noCompleted: 'No completed jobs yet.',
    earnings: 'Earnings',
    paid: 'Paid',
    owed: 'Owed',
    noPaymentHistory: 'No payment history yet.',
    notifications: 'Notifications',
    preferences: 'Preferences',
    noNotifications: 'No notifications yet.',
    unread: 'unread',
    startJob: 'Start job',
    markComplete: 'Mark complete',
    openDetails: 'Open details',
    jobPhotos: 'Job photos',
    pay: 'Pay',
    payment: 'Payment',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    appleIcs: 'Apple / ICS',
    loading: 'Loading…',
    back: 'Back',
    myJobs: 'My jobs',
    workspaceNotFound: 'Company not found.',
    jobNotFound: 'Job not found.',
    noAccess: 'You do not have access to this job.',
    viewOnly: 'View only',
    cancelled: 'Cancelled',
    completed: 'Completed',
    customer: 'Customer',
    address: 'Address',
    maps: 'Maps',
    contact: 'Contact',
    instructions: 'Instructions',
    yourPay: 'Your pay',
    payNotRecorded: 'Pay not recorded',
    growthRequired: 'Worker dashboard requires the Growth plan or a worker role.',
    loadErrorTitle: 'Could not load everything',
    tryAgain: 'Try again',
    job: 'Job',
    workDate: 'Work date',
    earned: 'Earned',
    outstanding: 'Outstanding',
    paidDate: 'Paid date',
    nav: {
      dashboard: 'Dashboard',
      jobs: 'Jobs',
      schedule: 'Schedule',
      earnings: 'Earnings',
      settings: 'Settings'
    },
    errors: {
      workerNotLinked:
        'Your worker account is not linked to a worker profile yet. Ask your company owner to assign you on a job.',
      jobsQueryFailed: 'Could not load your assigned jobs.',
      assignmentsQueryFailed: 'Could not load your job assignments.',
      laborQueryFailed: 'Could not load your worker pay records.',
      notificationsQueryFailed: 'Could not load your notifications.',
      permissionDenied: 'Access to worker pay or jobs was blocked. Contact your company owner.',
      unknown: 'Your worker dashboard could not be loaded. Refresh the page or contact your company owner.'
    }
  }
};

export const portalMessagesEs: PortalMessages = {
  common: {
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
    loading: 'Cargando…',
    back: 'Volver',
    open: 'Abrir',
    view: 'Ver',
    account: 'Cuenta',
    overview: 'Resumen',
    appointments: 'Citas',
    sections: 'Secciones del panel',
    dateNotSet: 'Fecha sin definir',
    notSet: 'Sin definir',
    status: 'Estado',
    due: 'Vence',
    save: 'Guardar',
    saving: 'Guardando…',
    saved: 'Guardado',
    language: 'Idioma'
  },
  status: {
    job: {
      new: 'Nuevo',
      scheduled: 'Programado',
      inProgress: 'En progreso',
      waiting: 'En espera',
      completed: 'Completado',
      cancelled: 'Cancelado',
      unknown: 'Desconocido'
    },
    payment: {
      paid: 'Pagado',
      unpaid: 'Sin pagar',
      partiallyPaid: 'Pagado parcialmente',
      pending: 'Pendiente',
      none: 'Ninguno',
      notSet: 'Sin definir',
      open: 'Abierto',
      draft: 'Borrador',
      unknown: 'Desconocido'
    }
  },
  legal: {
    title: 'Legal',
    description: 'Revisa las políticas aplicables a tu acceso al panel.',
    privacy: 'Política de privacidad',
    terms: 'Términos del servicio',
    generalDisclaimer: 'Aviso legal general',
    customerDisclaimer: 'Aviso del panel del cliente',
    contractorDisclaimer: 'Aviso del trabajador'
  },
  account: {
    title: 'Configuración de la cuenta',
    description: 'Administra tu perfil, notificaciones, enlaces legales y eliminación de la cuenta.',
    backToOverview: 'Volver al resumen',
    loading: 'Cargando configuración de la cuenta…',
    profile: {
      title: 'Perfil',
      description: 'Actualiza los datos de contacto utilizados para las notificaciones de trabajos y cuenta.',
      firstName: 'Nombre',
      lastName: 'Apellido',
      displayName: 'Nombre para mostrar',
      phone: 'Teléfono',
      email: 'Correo electrónico',
      newEmail: 'Nuevo correo electrónico',
      newPassword: 'Nueva contraseña',
      keepEmail: 'Déjalo en blanco para conservar el correo actual',
      keepPassword: 'Déjalo en blanco para conservar la contraseña actual',
      saveAccount: 'Guardar cuenta'
    },
    notifications: {
      title: 'Notificaciones',
      clientDescription: 'Elige qué actualizaciones de citas y facturas deseas recibir por correo electrónico.',
      contractorDescription: 'Elige qué actualizaciones del trabajador deseas recibir por correo electrónico.',
      emailNotifications: 'Notificaciones por correo electrónico',
      clientOperational: 'Actualizaciones de citas y facturas',
      contractorOperational: 'Actualizaciones de trabajos y pagos',
      productUpdates: 'Actualizaciones del producto'
    },
    calendar: {
      title: 'Calendario',
      clientDescription:
        'Usa Añadir al calendario en tus citas para Google, Outlook o Apple Calendar. Este panel no incluye integraciones de la empresa.',
      contractorDescription:
        'Usa Añadir al calendario en un trabajo asignado para crear un evento puntual. Las conexiones de Google Calendar y QuickBooks de toda la empresa las gestiona el propietario de la empresa.'
    },
    delete: {
      dangerZone: 'Zona de peligro',
      deleteAccount: 'Eliminar cuenta',
      deleteMyAccount: 'Eliminar mi cuenta',
      subscriptionWarning:
        'Eliminar tu cuenta de EverittOS no cancela automáticamente una suscripción de App Store o Google Play. Gestiona esas suscripciones en Ajustes de Apple o en Suscripciones de Google Play.',
      activeSubscription: 'Debes cancelar las suscripciones activas antes de eliminar la cuenta.',
      goToBilling: 'Ir a Facturación',
      askOwnerCancel:
        'Pide al propietario de la empresa que cancele la facturación, o cancela primero cualquier suscripción de la tienda.',
      confirmTitle: 'Eliminar cuenta',
      confirmBody:
        '¿Seguro que quieres eliminar permanentemente tu cuenta? Esta acción no se puede deshacer y perderás el acceso a tu inicio de sesión. Los registros comerciales de la empresa se conservan cuando sea necesario.',
      typeToConfirm: 'Escribe DELETE para confirmar',
      cancel: 'Cancelar',
      deleting: 'Eliminando…',
      permanentlyDelete: 'Eliminar cuenta permanentemente',
      unableToDelete: 'No se pudo eliminar la cuenta.',
      unableToDeleteRetry: 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
      clientRetention:
        'Eliminar tu inicio de sesión quita el acceso al panel y los datos personales de tu perfil. Las facturas, los pagos, los trabajos completados y otros registros del servicio permanecen con tu proveedor de servicios cuando sea necesario.',
      contractorRetention:
        'Eliminar tu inicio de sesión quita tu acceso y los datos personales de tu perfil. El historial de trabajos de la empresa, los registros de clientes y los registros de pagos permanecen con la empresa contratante.',
      defaultPortalRetention:
        'Eliminar tu inicio de sesión quita el acceso al panel y los datos personales del perfil. Los registros de trabajos, facturas, pagos y auditoría de la empresa permanecen con el proveedor de servicios cuando sea necesario.',
      defaultOwnerRetention:
        'Elimina permanentemente tu cuenta y la información de perfil asociada. Esta acción no se puede deshacer. Eliminar tu cuenta personal de EverittOS no elimina automáticamente una empresa que poseas cuando se requiera otro manejo de la propiedad.'
    }
  },
  client: {
    portal: 'Panel del cliente',
    settingsTitle: 'Configuración de la cuenta',
    settingsDescription: 'Administra tu perfil, notificaciones, enlaces legales y eliminación de la cuenta.',
    yourService: 'Tu servicio',
    loadingPortal: 'Cargando tu panel del cliente...',
    loadingSharedJobs: 'Cargando tus trabajos compartidos...',
    sharedJobsTitle: 'Trabajos compartidos',
    sharedJobsDescription: 'Aquí solo aparecen los trabajos compartidos contigo.',
    noSharedTitle: 'Aún no hay trabajos compartidos',
    noSharedMessage:
      'Actualmente no hay trabajos compartidos con tu cuenta. Cuando una empresa comparta un trabajo contigo, aparecerá aquí.',
    openJob: 'Abrir trabajo',
    sharedJob: 'Trabajo compartido',
    sharedJobDescription: 'Consulta los detalles de la cita, los informes y las fotos compartidas contigo.',
    backToSharedJobs: 'Volver a trabajos compartidos',
    appointment: 'Cita',
    reports: 'Informes',
    noReports: 'Todavía no se han compartido informes para este trabajo.',
    openReport: 'Abrir informe',
    photos: 'Fotos',
    invoices: 'Facturas',
    amountPending: 'Importe pendiente',
    jobTotal: 'Total del trabajo',
    paid: 'Pagado',
    balanceDue: 'Saldo pendiente',
    jobNotFound: 'No se pudo encontrar este trabajo compartido.',
    jobLoadError: 'No se pudo cargar este trabajo compartido. Inténtalo de nuevo.',
    growthRequired: 'El panel del cliente requiere el plan Growth o superior, o un rol de cliente.',
    wrongAccountLink: 'Este enlace del panel pertenece a otra cuenta de cliente.',
    tabs: {
      dashboard: 'Resumen',
      jobs: 'Citas',
      schedule: 'Horario',
      reports: 'Informes y fotos',
      invoices: 'Facturas',
      profile: 'Cuenta'
    },
    dashboard: {
      upcomingAppointment: 'Próxima cita',
      noUpcoming: 'No hay citas próximas.',
      jobStatus: 'Estado del trabajo',
      noJobsShared: 'Aún no hay trabajos compartidos.',
      invoicesPayments: 'Facturas y pagos',
      noInvoices: 'Aún no hay facturas.',
      invoiceFallback: 'Factura',
      reportsPhotos: 'Informes y fotos',
      noSharedReports: 'Aún no hay informes compartidos.',
      viewReportsPhotos: 'Ver informes y fotos'
    },
    schedule: {
      title: 'Horario',
      viewDetails: 'Ver detalles'
    },
    profile: {
      title: 'Tu perfil',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono',
      business: 'Empresa',
      notSet: 'Sin definir',
      linkedCustomers: 'Registros de clientes vinculados',
      noEmail: 'Sin correo electrónico',
      noPhone: 'Sin teléfono',
      editAccount: 'Editar configuración de la cuenta',
      customerDisclaimer: 'Aviso del panel del cliente'
    },
    reportsTab: {
      sharedReports: 'Informes compartidos',
      noReportsShared: 'No se han compartido informes contigo.',
      appointmentReport: 'Informe de la cita',
      photosHeading: 'Fotos',
      noAppointments: 'Aún no hay citas.'
    },
    invoicesTab: {
      title: 'Facturas y pagos',
      none: 'No tienes facturas pendientes.',
      jobLabel: 'Trabajo'
    },
    jobsTab: {
      emptyTitle: 'Aún no hay trabajos compartidos',
      emptyBody:
        'Actualmente no hay trabajos compartidos con tu cuenta. Cuando una empresa comparta un trabajo contigo, aparecerá aquí.',
      hidePhotos: 'Ocultar fotos',
      viewPhotos: 'Ver fotos',
      noReportsForJob: 'No se han compartido informes contigo para este trabajo.',
      activityTimeline: 'Cronología de actividad',
      jobUpdate: 'Actualización del trabajo'
    }
  },
  contractor: {
    portal: 'Panel del trabajador',
    accountLabel: 'Cuenta de trabajador',
    settingsTitle: 'Configuración de la cuenta',
    settingsDescription: 'Administra tu perfil, notificaciones, enlaces legales y eliminación de la cuenta.',
    today: 'Hoy',
    todaysJobs: 'Trabajos de hoy',
    upcomingJobs: 'Próximos trabajos',
    pastJobs: 'Trabajos anteriores',
    nothingToday: 'No hay nada programado para hoy.',
    noUpcoming: 'No hay próximos trabajos.',
    noCompleted: 'Aún no hay trabajos completados.',
    earnings: 'Ganancias',
    paid: 'Pagado',
    owed: 'Pendiente',
    noPaymentHistory: 'Aún no hay historial de pagos.',
    notifications: 'Notificaciones',
    preferences: 'Preferencias',
    noNotifications: 'Aún no hay notificaciones.',
    unread: 'sin leer',
    startJob: 'Iniciar trabajo',
    markComplete: 'Marcar como completado',
    openDetails: 'Abrir detalles',
    jobPhotos: 'Fotos del trabajo',
    pay: 'Pago',
    payment: 'Pago',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    appleIcs: 'Apple / ICS',
    loading: 'Cargando…',
    back: 'Volver',
    myJobs: 'Mis trabajos',
    workspaceNotFound: 'No se encontró la empresa.',
    jobNotFound: 'No se encontró el trabajo.',
    noAccess: 'No tienes acceso a este trabajo.',
    viewOnly: 'Solo lectura',
    cancelled: 'Cancelado',
    completed: 'Completado',
    customer: 'Cliente',
    address: 'Dirección',
    maps: 'Mapas',
    contact: 'Contacto',
    instructions: 'Instrucciones',
    yourPay: 'Tu pago',
    payNotRecorded: 'Pago no registrado',
    growthRequired: 'El panel del trabajador requiere el plan Growth o un rol de trabajador.',
    loadErrorTitle: 'No se pudo cargar todo',
    tryAgain: 'Intentar de nuevo',
    job: 'Trabajo',
    workDate: 'Fecha de trabajo',
    earned: 'Ganado',
    outstanding: 'Pendiente',
    paidDate: 'Fecha de pago',
    nav: {
      dashboard: 'Panel',
      jobs: 'Trabajos',
      schedule: 'Horario',
      earnings: 'Ganancias',
      settings: 'Configuración'
    },
    errors: {
      workerNotLinked:
        'Tu cuenta de trabajador aún no está vinculada a un perfil de trabajador. Pide al propietario de la empresa que te asigne a un trabajo.',
      jobsQueryFailed: 'No se pudieron cargar tus trabajos asignados.',
      assignmentsQueryFailed: 'No se pudieron cargar tus asignaciones de trabajo.',
      laborQueryFailed: 'No se pudieron cargar tus registros de pago de trabajador.',
      notificationsQueryFailed: 'No se pudieron cargar tus notificaciones.',
      permissionDenied:
        'Se bloqueó el acceso a los pagos o trabajos del trabajador. Contacta al propietario de la empresa.',
      unknown:
        'No se pudo cargar tu panel de trabajador. Actualiza la página o contacta al propietario de la empresa.'
    }
  }
};

export const portalMessagesVi: PortalMessages = {
  common: {
    signOut: 'Đăng xuất',
    signingOut: 'Đang đăng xuất…',
    loading: 'Đang tải…',
    back: 'Quay lại',
    open: 'Mở',
    view: 'Xem',
    account: 'Tài khoản',
    overview: 'Tổng quan',
    appointments: 'Lịch hẹn',
    sections: 'Các mục trong bảng điều khiển',
    dateNotSet: 'Chưa đặt ngày',
    notSet: 'Chưa đặt',
    status: 'Trạng thái',
    due: 'Hạn',
    save: 'Lưu',
    saving: 'Đang lưu…',
    saved: 'Đã lưu',
    language: 'Ngôn ngữ'
  },
  status: {
    job: {
      new: 'Mới',
      scheduled: 'Đã lên lịch',
      inProgress: 'Đang thực hiện',
      waiting: 'Đang chờ',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy',
      unknown: 'Không xác định'
    },
    payment: {
      paid: 'Đã trả',
      unpaid: 'Chưa trả',
      partiallyPaid: 'Trả một phần',
      pending: 'Đang chờ',
      none: 'Không có',
      notSet: 'Chưa đặt',
      open: 'Đang mở',
      draft: 'Nháp',
      unknown: 'Không xác định'
    }
  },
  legal: {
    title: 'Pháp lý',
    description: 'Xem các chính sách áp dụng cho quyền truy cập bảng điều khiển của bạn.',
    privacy: 'Chính sách quyền riêng tư',
    terms: 'Điều khoản dịch vụ',
    generalDisclaimer: 'Tuyên bố miễn trừ trách nhiệm chung',
    customerDisclaimer: 'Tuyên bố miễn trừ trách nhiệm của bảng điều khiển khách hàng',
    contractorDisclaimer: 'Tuyên bố miễn trừ trách nhiệm của nhân viên'
  },
  account: {
    title: 'Cài đặt tài khoản',
    description: 'Quản lý hồ sơ, thông báo, liên kết pháp lý và việc xóa tài khoản của bạn.',
    backToOverview: 'Quay lại tổng quan',
    loading: 'Đang tải cài đặt tài khoản…',
    profile: {
      title: 'Hồ sơ',
      description: 'Cập nhật thông tin liên hệ dùng cho thông báo công việc và tài khoản.',
      firstName: 'Tên',
      lastName: 'Họ',
      displayName: 'Tên hiển thị',
      phone: 'Điện thoại',
      email: 'Email',
      newEmail: 'Email mới',
      newPassword: 'Mật khẩu mới',
      keepEmail: 'Để trống để giữ email hiện tại',
      keepPassword: 'Để trống để giữ mật khẩu hiện tại',
      saveAccount: 'Lưu tài khoản'
    },
    notifications: {
      title: 'Thông báo',
      clientDescription: 'Chọn các cập nhật về lịch hẹn và hóa đơn mà bạn muốn nhận qua email.',
      contractorDescription: 'Chọn các cập nhật dành cho nhân viên mà bạn muốn nhận qua email.',
      emailNotifications: 'Thông báo qua email',
      clientOperational: 'Cập nhật lịch hẹn và hóa đơn',
      contractorOperational: 'Cập nhật công việc và thanh toán',
      productUpdates: 'Cập nhật sản phẩm'
    },
    calendar: {
      title: 'Lịch',
      clientDescription:
        'Dùng Thêm vào lịch trên các lịch hẹn của bạn cho Google, Outlook hoặc Apple Calendar. Bảng điều khiển này không bao gồm tích hợp của công ty.',
      contractorDescription:
        'Dùng Thêm vào lịch trên công việc được giao để tạo sự kiện lịch một lần. Kết nối Google Calendar và QuickBooks toàn công ty do chủ công ty quản lý.'
    },
    delete: {
      dangerZone: 'Khu vực nguy hiểm',
      deleteAccount: 'Xóa tài khoản',
      deleteMyAccount: 'Xóa tài khoản của tôi',
      subscriptionWarning:
        'Xóa tài khoản EverittOS của bạn không tự động hủy đăng ký App Store hoặc Google Play. Hãy quản lý các đăng ký đó trong Cài đặt Apple hoặc Đăng ký Google Play.',
      activeSubscription: 'Phải hủy các gói đăng ký đang hoạt động trước khi xóa tài khoản.',
      goToBilling: 'Đến Thanh toán',
      askOwnerCancel:
        'Yêu cầu chủ công ty hủy thanh toán, hoặc hủy trước mọi đăng ký trên cửa hàng ứng dụng.',
      confirmTitle: 'Xóa tài khoản',
      confirmBody:
        'Bạn có chắc muốn xóa vĩnh viễn tài khoản của mình không? Hành động này không thể hoàn tác và bạn sẽ mất quyền truy cập đăng nhập. Hồ sơ kinh doanh thuộc công ty được giữ lại khi cần thiết.',
      typeToConfirm: 'Nhập DELETE để xác nhận',
      cancel: 'Hủy',
      deleting: 'Đang xóa…',
      permanentlyDelete: 'Xóa tài khoản vĩnh viễn',
      unableToDelete: 'Không thể xóa tài khoản.',
      unableToDeleteRetry: 'Không thể xóa tài khoản. Vui lòng thử lại.',
      clientRetention:
        'Xóa thông tin đăng nhập sẽ gỡ quyền truy cập bảng điều khiển và thông tin hồ sơ cá nhân của bạn. Hóa đơn, thanh toán, công việc đã hoàn thành và các hồ sơ dịch vụ khác vẫn thuộc nhà cung cấp dịch vụ khi cần thiết.',
      contractorRetention:
        'Xóa thông tin đăng nhập sẽ gỡ quyền truy cập và thông tin hồ sơ cá nhân của bạn. Lịch sử công việc của công ty, hồ sơ khách hàng và hồ sơ thanh toán vẫn thuộc công ty thuê.',
      defaultPortalRetention:
        'Xóa thông tin đăng nhập sẽ gỡ quyền truy cập bảng điều khiển và thông tin hồ sơ cá nhân. Hồ sơ công việc, hóa đơn, thanh toán và kiểm toán thuộc công ty vẫn được giữ lại với nhà cung cấp dịch vụ khi cần thiết.',
      defaultOwnerRetention:
        'Xóa vĩnh viễn tài khoản và thông tin hồ sơ liên quan. Hành động này không thể hoàn tác. Xóa tài khoản cá nhân EverittOS của bạn không tự động xóa công ty bạn sở hữu khi cần xử lý quyền sở hữu theo cách khác.'
    }
  },
  client: {
    portal: 'Bảng điều khiển khách hàng',
    settingsTitle: 'Cài đặt tài khoản',
    settingsDescription: 'Quản lý hồ sơ, thông báo, liên kết pháp lý và việc xóa tài khoản của bạn.',
    yourService: 'Dịch vụ của bạn',
    loadingPortal: 'Đang tải bảng điều khiển khách hàng...',
    loadingSharedJobs: 'Đang tải các công việc được chia sẻ...',
    sharedJobsTitle: 'Công việc được chia sẻ',
    sharedJobsDescription: 'Chỉ những công việc được chia sẻ với bạn mới xuất hiện tại đây.',
    noSharedTitle: 'Chưa có công việc được chia sẻ',
    noSharedMessage:
      'Hiện chưa có công việc nào được chia sẻ với tài khoản của bạn. Khi một doanh nghiệp chia sẻ công việc với bạn, công việc đó sẽ xuất hiện tại đây.',
    openJob: 'Mở công việc',
    sharedJob: 'Công việc được chia sẻ',
    sharedJobDescription: 'Xem chi tiết lịch hẹn, báo cáo và hình ảnh được chia sẻ với bạn.',
    backToSharedJobs: 'Quay lại công việc được chia sẻ',
    appointment: 'Lịch hẹn',
    reports: 'Báo cáo',
    noReports: 'Chưa có báo cáo nào được chia sẻ cho công việc này.',
    openReport: 'Mở báo cáo',
    photos: 'Hình ảnh',
    invoices: 'Hóa đơn',
    amountPending: 'Số tiền đang chờ',
    jobTotal: 'Tổng công việc',
    paid: 'Đã thanh toán',
    balanceDue: 'Số còn lại',
    jobNotFound: 'Không tìm thấy công việc được chia sẻ này.',
    jobLoadError: 'Không thể tải công việc được chia sẻ này. Vui lòng thử lại.',
    growthRequired: 'Bảng điều khiển khách hàng yêu cầu gói Growth trở lên, hoặc vai trò khách hàng.',
    wrongAccountLink: 'Liên kết bảng điều khiển này thuộc về một tài khoản khách hàng khác.',
    tabs: {
      dashboard: 'Tổng quan',
      jobs: 'Lịch hẹn',
      schedule: 'Lịch trình',
      reports: 'Báo cáo và hình ảnh',
      invoices: 'Hóa đơn',
      profile: 'Tài khoản'
    },
    dashboard: {
      upcomingAppointment: 'Lịch hẹn sắp tới',
      noUpcoming: 'Không có lịch hẹn sắp tới.',
      jobStatus: 'Trạng thái công việc',
      noJobsShared: 'Chưa có công việc được chia sẻ.',
      invoicesPayments: 'Hóa đơn và thanh toán',
      noInvoices: 'Chưa có hóa đơn.',
      invoiceFallback: 'Hóa đơn',
      reportsPhotos: 'Báo cáo và hình ảnh',
      noSharedReports: 'Chưa có báo cáo được chia sẻ.',
      viewReportsPhotos: 'Xem báo cáo và hình ảnh'
    },
    schedule: {
      title: 'Lịch trình',
      viewDetails: 'Xem chi tiết'
    },
    profile: {
      title: 'Hồ sơ của bạn',
      name: 'Tên',
      email: 'Email',
      phone: 'Điện thoại',
      business: 'Doanh nghiệp',
      notSet: 'Chưa đặt',
      linkedCustomers: 'Hồ sơ khách hàng được liên kết',
      noEmail: 'Không có email',
      noPhone: 'Không có số điện thoại',
      editAccount: 'Chỉnh sửa cài đặt tài khoản',
      customerDisclaimer: 'Tuyên bố miễn trừ trách nhiệm của bảng điều khiển khách hàng'
    },
    reportsTab: {
      sharedReports: 'Báo cáo được chia sẻ',
      noReportsShared: 'Chưa có báo cáo nào được chia sẻ với bạn.',
      appointmentReport: 'Báo cáo lịch hẹn',
      photosHeading: 'Hình ảnh',
      noAppointments: 'Chưa có lịch hẹn.'
    },
    invoicesTab: {
      title: 'Hóa đơn và thanh toán',
      none: 'Bạn không có hóa đơn nào đang mở.',
      jobLabel: 'Công việc'
    },
    jobsTab: {
      emptyTitle: 'Chưa có công việc được chia sẻ',
      emptyBody:
        'Hiện chưa có công việc nào được chia sẻ với tài khoản của bạn. Khi một doanh nghiệp chia sẻ công việc với bạn, công việc đó sẽ xuất hiện tại đây.',
      hidePhotos: 'Ẩn hình ảnh',
      viewPhotos: 'Xem hình ảnh',
      noReportsForJob: 'Chưa có báo cáo nào được chia sẻ với bạn cho công việc này.',
      activityTimeline: 'Dòng thời gian hoạt động',
      jobUpdate: 'Cập nhật công việc'
    }
  },
  contractor: {
    portal: 'Bảng điều khiển nhân viên',
    accountLabel: 'Tài khoản nhân viên',
    settingsTitle: 'Cài đặt tài khoản',
    settingsDescription: 'Quản lý hồ sơ, thông báo, liên kết pháp lý và việc xóa tài khoản của bạn.',
    today: 'Hôm nay',
    todaysJobs: 'Công việc hôm nay',
    upcomingJobs: 'Công việc sắp tới',
    pastJobs: 'Công việc trước đây',
    nothingToday: 'Hôm nay không có công việc nào được lên lịch.',
    noUpcoming: 'Không có công việc sắp tới.',
    noCompleted: 'Chưa có công việc hoàn thành.',
    earnings: 'Thu nhập',
    paid: 'Đã trả',
    owed: 'Còn nợ',
    noPaymentHistory: 'Chưa có lịch sử thanh toán.',
    notifications: 'Thông báo',
    preferences: 'Tùy chọn',
    noNotifications: 'Chưa có thông báo.',
    unread: 'chưa đọc',
    startJob: 'Bắt đầu công việc',
    markComplete: 'Đánh dấu hoàn thành',
    openDetails: 'Mở chi tiết',
    jobPhotos: 'Hình ảnh công việc',
    pay: 'Tiền công',
    payment: 'Thanh toán',
    googleCalendar: 'Google Calendar',
    outlook: 'Outlook',
    appleIcs: 'Apple / ICS',
    loading: 'Đang tải…',
    back: 'Quay lại',
    myJobs: 'Công việc của tôi',
    workspaceNotFound: 'Không tìm thấy công ty.',
    jobNotFound: 'Không tìm thấy công việc.',
    noAccess: 'Bạn không có quyền truy cập công việc này.',
    viewOnly: 'Chỉ xem',
    cancelled: 'Đã hủy',
    completed: 'Hoàn thành',
    customer: 'Khách hàng',
    address: 'Địa chỉ',
    maps: 'Bản đồ',
    contact: 'Liên hệ',
    instructions: 'Hướng dẫn',
    yourPay: 'Tiền công của bạn',
    payNotRecorded: 'Chưa ghi nhận tiền công',
    growthRequired: 'Bảng điều khiển nhân viên yêu cầu gói Growth hoặc vai trò nhân viên.',
    loadErrorTitle: 'Không thể tải mọi thứ',
    tryAgain: 'Thử lại',
    job: 'Công việc',
    workDate: 'Ngày làm việc',
    earned: 'Đã kiếm',
    outstanding: 'Còn nợ',
    paidDate: 'Ngày thanh toán',
    nav: {
      dashboard: 'Bảng điều khiển',
      jobs: 'Công việc',
      schedule: 'Lịch trình',
      earnings: 'Thu nhập',
      settings: 'Cài đặt'
    },
    errors: {
      workerNotLinked:
        'Tài khoản nhân viên của bạn chưa được liên kết với hồ sơ nhân viên. Hãy nhờ chủ công ty gán bạn vào một công việc.',
      jobsQueryFailed: 'Không thể tải các công việc được giao của bạn.',
      assignmentsQueryFailed: 'Không thể tải các phân công công việc của bạn.',
      laborQueryFailed: 'Không thể tải hồ sơ thanh toán nhân viên của bạn.',
      notificationsQueryFailed: 'Không thể tải thông báo của bạn.',
      permissionDenied:
        'Quyền truy cập thanh toán hoặc công việc nhân viên đã bị chặn. Hãy liên hệ chủ công ty.',
      unknown:
        'Không thể tải bảng điều khiển nhân viên của bạn. Hãy làm mới trang hoặc liên hệ chủ công ty.'
    }
  }
};
