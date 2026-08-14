import type { Messages } from '@/lib/i18n/types';
import { portalMessagesEs } from '@/lib/i18n/portal-messages';

export const messages: Messages = {
  common: {
    continue: 'Continuar',
    skip: 'Omitir',
    skipThisStep: 'Omitir este paso',
    skipAllSetup: 'Omitir toda la configuración',
    cancelSetup: 'Cancelar configuración',
    back: 'Atrás',
    loading: 'Cargando…',
    connect: 'Conectar',
    connectLater: 'Conectar después',
    addAnother: 'Agregar otro',
    goToDashboard: 'Ir al panel',
    exploreFeatures: 'Explorar funciones',
    optional: 'Opcional',
    language: 'Idioma',
    close: 'Cerrar',
    cancel: 'Cancelar'
  },
  ux: {
    appName: 'EverittOS',
    mobileNavLabel: 'Navegación principal',
    logOut: 'Cerrar sesión',
    startPro: 'Empezar Pro',
    viewPlans: 'Ver planes',
    attentionNeeded: 'Requiere atención',
    progressTitle: 'Su progreso',
    advancedTools: 'Más herramientas',
    helperSchedule: 'Vea el calendario y asigne trabajo.',
    helperAnalytics: 'Rendimiento y tendencias de su espacio de trabajo.',
    helperBilling: 'Facturas, pagos y su suscripción.',
    pageTitles: {
      schedule: 'Calendario y trabajo',
      analytics: 'Rendimiento del negocio',
      billing: 'Facturas y pagos',
      customers: 'Gestione clientes, prospectos y seguimientos en un solo lugar.'
    },
    tapHint: 'Toque para ver detalles'
  },
  onboarding: {
    progress: 'Paso {current} de {total}',
    loading: 'Cargando su espacio de trabajo…',
    calendarLater: 'La integración del calendario se puede conectar más tarde.',
    calendarNotConfigured:
      'La conexión del calendario aún no está configurada. Puede continuar y agregarla después en Configuración.',
    calendarConnected: 'Google Calendar está conectado.',
    connectGoogleCalendar: 'Conectar Google Calendar',
    openIntegrations: 'Abrir integraciones',
    inviteFailed: 'No se pudo enviar la invitación. Puede invitar al equipo desde Configuración.',
    teamUpgradeRequired: 'Las invitaciones de equipo requieren Business o superior. Actualice la facturación.',
    inviteLinkReady: 'Invitación creada. Copie el enlace porque el correo no está configurado.',
    inviteLinkCopied: 'Enlace de invitación copiado.',
    copyInviteLink: 'Copiar enlace de invitación',
    steps: {
      welcome: {
        title: 'Bienvenido a EverittOS',
        subtitle:
          'Gestione trabajos, clientes, horarios, equipo y operaciones desde un solo lugar.'
      },
      business: {
        title: 'Perfil del negocio',
        subtitle: 'Cuéntenos sobre su empresa. Todos los campos son opcionales.',
        companyName: 'Nombre de la empresa',
        industry: 'Industria',
        teamSize: 'Tamaño del equipo'
      },
      operations: {
        title: 'Configuración operativa',
        subtitle: '¿Qué gestiona? Seleccione todas las que correspondan.'
      },
      team: {
        title: 'Invite a su equipo',
        subtitle: 'Agregue compañeros ahora u omita e invite después. Ningún campo es obligatorio.',
        email: 'Correo electrónico',
        role: 'Rol'
      },
      calendar: {
        title: 'Conecte su calendario',
        subtitle: 'Sincronice trabajos programados con Google Calendar o conéctelo después en Configuración.',
        google: 'Google Calendar'
      },
      firstJob: {
        title: 'Cree su primer trabajo',
        subtitle: 'Agregue su primer trabajo ahora, o omita y créelo después desde el panel.',
        jobName: 'Nombre del trabajo',
        customer: 'Cliente',
        date: 'Fecha'
      },
      complete: {
        title: 'Su espacio de trabajo está listo',
        message:
          'Ahora puede gestionar trabajos, clientes, horarios, equipo y operaciones desde su panel.'
      }
    },
    industries: {
      property_management: 'Administración de propiedades',
      cleaning: 'Limpieza',
      salon: 'Salón',
      barber: 'Barbería',
      spa: 'Spa',
      beauty_studio: 'Estudio de belleza',
      maintenance: 'Mantenimiento',
      construction: 'Construcción',
      general_contractor: 'Trabajador general',
      landscaping: 'Paisajismo',
      field_service: 'Servicio de campo',
      janitorial: 'Limpieza comercial',
      real_estate: 'Bienes raíces',
      home_services: 'Servicios del hogar',
      hospitality: 'Hospitalidad',
      other: 'Otro'
    },
    teamSizes: {
      solo: 'Solo yo',
      small: '2-5',
      medium: '6-20',
      large: '21-50',
      enterprise: '50+'
    },
    operations: {
      jobs: 'Trabajos',
      properties: 'Propiedades',
      customers: 'Clientes',
      contractors: 'Trabajadores',
      workers: 'Equipo',
      maintenance: 'Mantenimiento',
      cleaning: 'Limpieza',
      inspections: 'Inspecciones',
      other: 'Otro'
    },
    roles: {
      admin: 'Administrador',
      manager: 'Gerente',
      worker: 'Empleado'
    },
    checklist: {
      title: 'Primeros pasos',
      description:
        'Configuración opcional para ayudarle a comenzar más rápido. Omita cuando quiera. Nada bloquea su trabajo.',
      dismiss: 'Descartar',
      continue: 'Continuar configuración',
      settings: 'Configuración del espacio',
      steps: [
        'Bienvenida',
        'Perfil del negocio',
        'Operaciones',
        'Invitaciones',
        'Calendario',
        'Primer trabajo',
        'Completado'
      ]
    },
    settings: {
      restart: 'Reiniciar configuración',
      restartDescription: 'Repita la configuración desde el inicio.',
      restartConfirm: '¿Reiniciar configuración?',
      restartSuccess: 'Configuración reiniciada. Continúe desde la pantalla de bienvenida.'
    }
  },
  empty: {
    jobs: {
      title: 'Sin trabajos aún',
      description: 'Cree su primer trabajo para comenzar a organizar el trabajo.',
      action: 'Crear trabajo'
    },
    customers: {
      title: 'Sin clientes aún',
      description:
        'Agregue su primer cliente para rastrear trabajos, notas, facturas y seguimientos.',
      action: 'Agregar cliente'
    },
    leads: {
      title: 'Sin prospectos aún',
      description: 'Capture su primer prospecto para rastrear fuentes y conversión.',
      action: 'Agregar prospecto',
      secondaryAction: 'Crear un formulario'
    },
    schedule: {
      title: 'Sin programación',
      description: 'Programe su primera cita para ver el trabajo en el calendario.',
      action: 'Programar trabajo'
    },
    workers: {
      title: 'Aún no hay miembros del equipo',
      description: 'Invite a miembros del equipo para asignar trabajos y gestionar acceso.',
      action: 'Invitar miembro del equipo'
    },
    activity: {
      title: 'Sin actividad aún',
      description: 'La actividad de su empresa aparecerá aquí.'
    },
    notifications: {
      title: 'Sin notificaciones aún',
      description: 'Asignaciones, invitaciones y actualizaciones de facturación aparecerán aquí.'
    },
    workflows: {
      title: 'Sin flujos de trabajo aún',
      description: 'Cree una lista de verificación para los mismos pasos en cada trabajo.'
    },
    photos: {
      title: 'Sin fotos antes/después aún',
      description: 'Suba fotos de antes y después para documentar el trabajo completado.'
    },
    reviews: {
      title: 'Sin reseñas aún',
      description: 'Envíe una solicitud de reseña después de un trabajo.',
      action: 'Enviar solicitud'
    },
    forms: {
      title: 'Sin formularios aún',
      description: 'Cree un formulario para captar prospectos desde su sitio web.',
      action: 'Crear formulario'
    },
    templates: {
      title: 'Sin plantillas aún',
      description: 'Guarde propuestas, SOPs y correos reutilizables para su equipo.',
      action: 'Nueva plantilla'
    },
    expenses: {
      title: 'Sin gastos aún',
      description: 'Registre gastos por trabajo para entender la rentabilidad.',
      action: 'Agregar gasto'
    },
    invoices: {
      title: 'Sin facturas aún',
      description: 'Envíe su primera factura para cobrar el trabajo completado.',
      action: 'Enviar factura'
    },
    analytics: {
      title: 'Sin analíticas aún',
      description: 'Cree clientes, trabajos y facturas para ver métricas de ingresos.',
      action: 'Ir al panel'
    }
  },
  legal: {
    terms: 'Términos',
    privacy: 'Privacidad',
    termsOfService: 'Términos de servicio',
    privacyPolicy: 'Política de privacidad',
    refundPolicy: 'Política sin reembolsos',
    cookies: 'Cookies',
    security: 'Seguridad',
    support: 'Soporte',
    footerLabel: 'Legal y políticas',
    footerNav: 'Enlaces legales'
  },
  cookies: {
    banner: {
      title: 'Preferencias de cookies',
      description:
        'Usamos cookies esenciales para inicio de sesión y seguridad. Las cookies de análisis son opcionales.',
      policy: 'Política de cookies',
      privacy: 'Política de privacidad',
      acceptAll: 'Aceptar todo',
      reject: 'Rechazar no esenciales',
      manage: 'Gestionar preferencias',
      save: 'Guardar preferencias'
    },
    categories: {
      necessary: 'Necesarias',
      necessaryDesc: 'Requeridas para autenticación y funciones principales.',
      analytics: 'Análisis',
      analyticsDesc: 'Nos ayuda a entender el uso de registro y marketing.',
      marketing: 'Marketing',
      marketingDesc: 'Reservado para comunicaciones promocionales futuras.'
    }
  },
  settings: {
    privacy: {
      title: 'Privacidad y datos',
      description: 'Controle sus datos, comunicaciones y preferencias de cumplimiento.',
      disclosureTitle: 'Qué recopilamos',
      disclosureBody: 'EverittOS recopila solo lo necesario para operar su espacio de trabajo.',
      collectProfile: 'Perfil: correo, rol, nombre comercial y configuración.',
      collectOperations: 'Datos operativos: trabajos, clientes, equipo, horarios y fotos.',
      collectActivity: 'Registros de actividad: acciones en su espacio de trabajo.',
      collectPasskeys:
        'Las llaves de acceso aún no están habilitadas. Si se agregan después, las credenciales permanecerían en su dispositivo.',
      retention: 'Los datos se conservan mientras su cuenta esté activa y se eliminan según su solicitud.',
      preferencesTitle: 'Preferencias de comunicación',
      marketingEmails: 'Correos de marketing',
      productUpdates: 'Actualizaciones del producto',
      operationalNotifications: 'Notificaciones operativas',
      doNotSell: 'No vender ni compartir mi información',
      doNotSellDesc: 'EverittOS no vende datos personales. Active esto para registrar su preferencia CCPA.',
      save: 'Guardar preferencias',
      saved: 'Preferencias de privacidad guardadas.',
      saveError: 'No se pudieron guardar las preferencias.',
      languageTitle: 'Idioma',
      exportTitle: 'Descargar sus datos',
      exportDescription: 'Exporte perfil, trabajos, clientes, equipo y actividad en JSON.',
      exportButton: 'Descargar exportación',
      exportSuccess: 'La exportación de datos ha comenzado.',
      exportError: 'No se pudo exportar los datos.',
      consentTitle: 'Aceptación legal',
      termsAccepted: 'Términos aceptados',
      privacyAccepted: 'Privacidad aceptada',
      termsNotRecorded: 'Aceptación de términos no registrada.',
      privacyNotRecorded: 'Aceptación de privacidad no registrada.'
    },
    notifications: {
      title: 'Notificaciones',
      description: 'Elija cómo EverittOS se comunica con usted.',
      email: 'Notificaciones por correo',
      operational: 'Alertas operativas (asignaciones, fechas, invitaciones)',
      push: 'Notificaciones push',
      pushFuture: 'Aún no disponible en esta versión.',
      sms: 'Notificaciones SMS',
      smsFuture: 'Aún no disponible en esta versión.',
      save: 'Guardar notificaciones',
      saved: 'Configuración de notificaciones guardada.',
      saveError: 'No se pudo guardar la configuración.'
    },
    nav: {
      privacy: 'Privacidad',
      notifications: 'Notificaciones'
    },
    security: {
      passkeysTitle: 'Llaves de acceso',
      passkeysBody: 'Agregue passkeys para un inicio de sesión más rápido y seguro en dispositivos compatibles.',
      compromised: 'Si cree que su cuenta o dispositivo se ha visto comprometido, contáctenos en'
    },
    account: {
      description: 'Correo, rol, suscripción y estado de la cuenta.',
      profile: 'Perfil',
      email: 'Correo',
      role: 'Rol',
      accountStatus: 'Estado de la cuenta',
      active: 'Activa',
      disabled: 'Desactivada',
      manageBilling: 'Gestionar facturación',
      workspaceSettings: 'Configuración de la empresa',
      subscription: 'Suscripción',
      subscriptionNote: 'Cancele, reanude o cambie planes desde facturación.',
      subscriptionOwnerOnly: 'Solo propietarios y administradores pueden cambiar la facturación.',
      openBilling: 'Abrir facturación',
      languageTitle: 'Idioma',
      languageNote: 'Aplica a navegación, panel, trabajos, clientes, reservas, equipo, horario, facturación y ajustes.',
      disableTitle: 'Desactivar cuenta',
      disableNote:
        'Desactivar cierra su sesión y bloquea el acceso. Los datos de su organización se conservan. Nada se elimina.',
      ownerDisableWarning: 'Es el propietario del espacio. Desactivar solo bloquea su cuenta. Transfiera la propiedad en',
      restoreContact: 'Contacte soporte para restaurar el acceso:',
      disabling: 'Desactivando…',
      disableConfirmTitle: '¿Desactivar su cuenta?',
      disableConfirmBody: 'Se cerrará su sesión y no podrá acceder a páginas protegidas hasta que soporte restaure el acceso.',
      disableFailed: 'No se pudo desactivar la cuenta.',
      disabledDetail: 'Cuenta desactivada a su solicitud.'
    }
  },
  analytics: {
    adoption: 'Métricas de adopción',
    growth: 'Métricas de crecimiento',
    usage: 'Métricas de uso'
  },
  auth: {
    acceptTerms: 'Acepto los Términos de servicio',
    acceptPrivacy: 'Acepto la Política de privacidad',
    acceptTermsAndPrivacy: 'Acepto los Términos de servicio y la Política de privacidad',
    agreeToTermsPrefix: 'Acepto los',
    agreeToTermsAnd: 'y la',
    continuingLegalPrefix: 'Al continuar, acepta los',
    continuingLegalAcknowledge: ', reconoce la',
    continuingLegalUnderstand: ' y comprende nuestra',
    consentRequired: 'Debe aceptar los Términos y la Política de privacidad para crear una cuenta.',
    signInMethods: 'Inicie sesión con correo y contraseña, o use una passkey si la agregó.',
    signUpMethods: 'Cree una cuenta con correo y contraseña. Puede agregar una passkey después del registro.'
  },
  nav: {
    today: 'Hoy',
    money: 'Dinero',
    more: 'Más',
    commandCenter: 'Dashboard',
    dashboard: 'Panel',
    forms: 'Formularios',
    templates: 'Plantillas',
    reviews: 'Reseñas',
    proposals: 'Propuestas',
    estimates: 'Presupuestos',
    invoices: 'Facturas',
    messages: 'Mensajes',
    leads: 'Prospectos',
    services: 'Servicios',
    bookings: 'Reservas',
    jobs: 'Trabajos',
    crm: 'Clientes',
    customers: 'Clientes',
    projects: 'Proyectos',
    knowledge: 'Conocimiento',
    automations: 'Automatizaciones',
    clients: 'Clientes',
    schedule: 'Horario',
    expenses: 'Gastos',
    workers: 'Equipo',
    team: 'Equipo',
    activity: 'Actividad',
    analytics: 'Analítica',
    workflows: 'Flujos',
    notifications: 'Notificaciones',
    billing: 'Planes y facturación',
    settings: 'Configuración',
    clientPortal: 'Panel del cliente',
    contractorPortal: 'Panel del trabajador',
    sectionTools: 'Herramientas',
    sectionInsights: 'Información',
    inventory: 'Inventario',
    routes: 'Rutas',
    photos: 'Fotos'
  },
  settingsNav: {
    workspace: 'Empresa',
    team: 'Equipo',
    branding: 'Marca',
    integrations: 'Integraciones',
    account: 'Cuenta',
    billing: 'Planes y facturación',
    security: 'Seguridad',
    privacy: 'Privacidad',
    notifications: 'Notificaciones',
    supportTraining: 'Soporte y capacitación',
    api: 'API',
    aiMemory: 'Memoria IA',
    aiUsage: 'Uso de IA',
    departments: 'Departamentos'
  },
  supportTraining: {
    pricingHeadline: '¿Necesita ayuda para empezar?',
    pricingBody:
      'Reserve una llamada gratuita de incorporación de 30 minutos y le ayudaremos a configurar sus primeros clientes, trabajos, equipo, horario, facturas y SOP.',
    itemOnboardingCall: 'Llamada gratuita de incorporación de 30 minutos',
    itemSopSetup: 'Configuración de SOP disponible',
    itemTeamTraining: 'Capacitación de equipo disponible',
    bookOnboardingCall: 'Reservar llamada gratuita de incorporación',
    welcomeTitle: 'Bienvenido a EverittOS.',
    welcomeBody:
      '¿Necesita ayuda para empezar? Reserve una llamada gratuita de incorporación de 30 minutos y le ayudaremos a configurar su cuenta.',
    bookFreeCall: 'Reservar llamada gratuita',
    dashboardTitle: '¿Necesita ayuda para configurar EverittOS?',
    dashboardBody:
      'Reserve una llamada gratuita de incorporación de 30 minutos y le ayudaremos a configurar sus primeros clientes, trabajos, equipo, horario, facturas y SOP.',
    settingsTitle: 'Soporte y capacitación',
    settingsDescription: 'Incorporación, configuración de SOP y capacitación de equipo con el equipo Everitt.',
    settingsEmailNote: 'También puede escribirnos a',
    contactEverittTeam: 'Contactar al equipo Everitt'
  },
  dashboard: {
    title: 'Hoy',
    subtitle: 'Lo que necesita su atención ahora.',
    navSubtitle: 'Use el menú o Ask Everitt para abrir clientes, trabajos, fotos, agenda, facturas, equipo y configuración.',
    helpAriaLabel: 'Soporte de EverittOS',
    welcome: 'Bienvenido de nuevo',
    welcomeName: 'Bienvenido de nuevo, {name}',
    subtitleToday: 'Esto es lo que ocurre hoy.',
    newJob: 'Nuevo trabajo',
    quickActions: {
      createJob: 'Crear trabajo',
      addCustomer: 'Agregar cliente',
      sendInvoice: 'Enviar factura',
      scheduleWork: 'Programar trabajo',
      addWorker: 'Invitar persona'
    },
    attention: {
      overdueInvoices: 'Facturas sin pagar',
      unassignedJobs: 'Trabajos sin asignar',
      pendingEstimates: 'Presupuestos abiertos',
      followUpCustomers: 'Prospectos a seguir',
      upcomingAppointments: 'Citas próximas'
    },
    progress: {
      completedWeek: 'Completados esta semana',
      revenueMonth: 'Cobrado este mes',
      newCustomersMonth: 'Clientes nuevos este mes',
      openInvoices: 'Facturas abiertas',
      scheduledUpcoming: 'Programados adelante',
      hints: {
        completedWeek: 'Toque para ver trabajos completados',
        revenueMonth: 'Toque para ver pagos',
        newCustomersMonth: 'Toque para ver clientes nuevos',
        openInvoices: 'Toque para ver facturas abiertas',
        scheduledUpcoming: 'Toque para ver trabajo próximo'
      }
    },
    sidebar: {
      todayTasks: 'Tareas de hoy',
      notifications: 'Notificaciones',
      upcoming: 'Próximos',
      crmSnapshot: 'Resumen CRM',
      viewTasks: 'Ver tareas',
      openInbox: 'Abrir bandeja',
      openSchedule: 'Abrir horario',
      openCrm: 'Abrir CRM',
      leadsClients: '{leads} prospectos · {clients} clientes',
      hints: {
        todayTasks: 'Toque para ver tareas abiertas',
        notifications: 'Toque para abrir la bandeja',
        upcoming: 'Toque para ver el calendario',
        crmSnapshot: 'Toque para abrir clientes'
      }
    },
    todaysSchedule: 'Horario de hoy',
    viewSchedule: 'Horario',
    noScheduleToday: 'Nada programado hoy',
    upcomingJobs: 'Próximos trabajos',
    noUpcomingJobs: 'No hay trabajos próximos en las próximas dos semanas.',
    customersAndLeads: 'Clientes y prospectos',
    noCustomersOrLeads: 'Aún no hay clientes ni prospectos. Agrega el primero para comenzar.',
    myWork: 'Mi trabajo',
    myWorkSubtitle: 'Hoy, trabajos asignados, contacto con clientes y acciones de campo.',
    crm: {
      openLeads: 'Prospectos abiertos',
      openLeadsHelp: 'Nuevos, contactados, calificados, propuesta y reabiertos.',
      closedLeads: 'Prospectos cerrados',
      closedLeadsHelp: 'Ganados, perdidos y cancelados.',
      activeCustomers: 'Clientes activos',
      activeCustomersHelp: 'Clientes actualmente activos en su espacio de trabajo.',
      recurringCustomers: 'Clientes recurrentes',
      recurringCustomersHelp: 'Clientes marcados como cuentas de servicio recurrente.',
      inactiveCustomers: 'Clientes inactivos',
      inactiveCustomersHelp: 'Clientes inactivos y anteriores.'
    },
    businessActivity: 'Actividad comercial reciente',
    businessActivityEmpty:
      'Aún no hay actividad comercial. Crea tu primer cliente, prospecto o trabajo para comenzar.',
    revenue: {
      title: 'Resumen de ingresos',
      revenueMonth: 'Ingresos del mes',
      outstanding: 'Facturas pendientes',
      overdueInvoices: 'Facturas vencidas',
      jobsCompleted: 'Trabajos completados',
      completedThisMonth: 'Completados este mes',
      upcomingJobs: 'Trabajos próximos',
      activeCustomers: 'Clientes activos',
      expensesMonth: 'Gastos del mes',
      netEstimate: 'Estimación neta',
      bookingsMonth: 'Reservas del mes',
      messagesCount: 'Mensajes',
      reportsCount: 'Informes',
      viewAnalytics: 'Analítica'
    },
    primaryActions: 'Acciones rápidas',
    metricsLabel: 'Resumen',
    recentActivity: 'Actividad reciente',
    viewActivity: 'Ver todo',
    moreDetails: 'Plan y uso',
    finishSetup: 'Terminar configuración',
    actions: {
      newJob: 'Nuevo trabajo',
      schedule: 'Horario',
      customers: 'Clientes',
      workers: 'Equipo',
      billing: 'Facturación'
    },
    metrics: {
      jobsToday: 'Trabajos hoy',
      openJobs: 'Trabajos abiertos',
      completedJobs: 'Trabajos completados',
      dueInSevenDays: 'Vencen en 7 días',
      reports: 'Informes',
      teamMembers: 'Miembros del equipo',
      unpaidInvoices: 'Facturas sin pagar',
      upcomingSchedule: 'Próximos'
    },
    quickLinksLabel: 'Más',
    quickLinks: {
      jobs: 'Trabajos',
      notifications: 'Notificaciones',
      settings: 'Ajustes',
      activity: 'Actividad'
    },
    activityEmpty: 'Sin actividad aún',
    skipped: {
      label: 'Pendiente:',
      createJob: 'Crear trabajo',
      addCustomer: 'Agregar cliente',
      inviteTeam: 'Invitar equipo',
      connectCalendar: 'Conectar calendario'
    },
    metricsEmpty: 'Sin métricas aún',
    analyticsEmpty: 'Las métricas aparecerán después de crear trabajos, informes y actividad del equipo.',
    teamCommand: {
      ariaLabel: 'Centro de mando del equipo',
      title: 'Centro de mando del equipo',
      subtitle: 'Vea quién está disponible, programado o necesita atención hoy.',
      loading: 'Cargando centro de mando del equipo...',
      loadError: 'No pudimos cargar el centro de mando del equipo. Actualice e intente de nuevo.',
      metrics: {
        onJob: 'En trabajo',
        dueToday: 'Para hoy',
        needsAttention: 'Requiere atención',
        availableTeam: 'Equipo disponible'
      },
      overview: {
        title: 'Resumen del equipo',
        description: 'Abra un miembro del equipo para ver horario, asignación y contacto.',
        empty: 'Aún no hay miembros del equipo. Invite a miembros del equipo o asigne trabajos para ver la carga aquí.'
      },
      status: {
        needsAttention: 'Requiere atención',
        onJob: 'En trabajo',
        scheduled: 'Programado',
        overloaded: 'Sobrecargado',
        available: 'Disponible'
      },
      summary: {
        readyForAssignment: 'Listo para asignación',
        activeJobsOne: '{count} trabajo activo',
        activeJobsMany: '{count} trabajos activos',
        dueTodayCount: '{count} para hoy',
        nextPrefix: 'Siguiente:',
        updatedPrefix: 'Actualizado:',
        notUpdatedYet: 'Aún sin actualizar'
      },
      member: {
        defaultName: 'Miembro del equipo',
        active: 'Activos',
        dueToday: 'Para hoy',
        overdue: 'Atrasados',
        completed: 'Completados',
        nextAssignment: 'Próxima asignación',
        noScheduledAssignment: 'Aún no hay asignación programada.',
        assignedDateNotScheduled: 'Asignado, fecha sin programar',
        contact: 'Contacto',
        noEmailOnFile: 'Sin correo registrado',
        viewSchedule: 'Ver horario',
        viewJobs: 'Ver trabajos',
        assignJob: 'Asignar trabajo'
      }
    },
    role: {
      workspaceTitle: 'Su empresa',
      workspaceTitleTeam: 'Centro de mando del equipo',
      workspaceIntro: 'Siga su trabajo activo, horario, fotos, informes y actividad del equipo.',
      workspaceIntroTeam: 'Vista de propietario y administrador solo en este espacio. Cada tarjeta abre los registros detrás del número.',
      viewTeam: 'Ver equipo',
      manageAccess: 'Administrar acceso',
      teamOverview: 'Resumen del equipo',
      teamOverviewHint: 'Vea la carga de cada persona sin salir del panel del propietario.',
      noTeamMembers: 'No se encontraron miembros activos del equipo.',
      lastActivity: 'Última actividad:',
      viewWorkload: 'Ver carga',
      upcomingTeamJobs: 'Próximos trabajos del equipo',
      upcomingJobs: 'Próximos trabajos',
      openSchedule: 'Abrir horario',
      noUpcomingDueDates: 'No hay fechas de vencimiento próximas.',
      recentTeamActivity: 'Actividad reciente del equipo',
      viewAuditTrail: 'Ver historial',
      noRecentActivity: 'Aún no hay actividad reciente.',
      teamMember: 'Miembro del equipo',
      quickOwnerActions: 'Acciones rápidas del propietario',
      assignJob: 'Asignar trabajo',
      quickActions: {
        messageTeam: 'Mensaje al equipo',
        reviewReports: 'Revisar informes',
        viewSchedule: 'Ver horario'
      },
      metrics: {
        teamActiveJobs: 'Trabajos activos del equipo',
        activeJobs: 'Trabajos activos',
        teamCompletedJobs: 'Trabajos completados del equipo',
        completed: 'Completados',
        teamOverdueJobs: 'Trabajos atrasados del equipo',
        overdue: 'Atrasados',
        customers: 'Clientes',
        teamMembers: 'Miembros del equipo',
        teamPhotos: 'Fotos del equipo',
        teamReports: 'Informes del equipo',
        teamActivity: 'Actividad del equipo',
        teamJobsThisMonth: 'Trabajos del equipo este mes',
        jobsThisMonth: 'Trabajos este mes',
        active: 'Activos',
        dueToday: 'Para hoy'
      },
      workload: {
        inactive: 'Inactivo',
        overloaded: 'Sobrecargado',
        busy: 'Ocupado',
        available: 'Disponible'
      },
      field: {
        title: 'Mi trabajo de campo',
        intro: 'Vista simple para trabajos asignados, fotos, listas de verificación y contacto con clientes.',
        myActiveJobs: 'Mis trabajos activos',
        dueToday: 'Para hoy',
        completed: 'Completados',
        photosUploaded: 'Fotos subidas',
        currentJob: 'Trabajo actual',
        currentJobHint: 'Abra el trabajo para iniciar, completar listas, subir fotos o marcarlo como terminado.',
        openJob: 'Abrir trabajo',
        noCustomerDetails: 'Sin datos del cliente',
        startOrFinish: 'Iniciar o terminar trabajo',
        callCustomer: 'Llamar al cliente',
        startNavigation: 'Iniciar navegación',
        noAssignedWork: 'Sin trabajo de campo asignado',
        noAssignedWorkHint: 'Los trabajos asignados aparecerán aquí con estado, contacto, fotos y acciones de lista.',
        myJobsToday: 'Mis trabajos de hoy',
        viewAll: 'Ver todo',
        noJobsToday: 'No hay trabajos para hoy.',
        noLocation: 'Sin ubicación',
        nextAssignedJobs: 'Próximos trabajos asignados',
        noUpcomingAssigned: 'No hay trabajos asignados próximos.',
        noActivityYet: 'Sin actividad aún',
        notScheduled: 'Sin programar'
      }
    }
  },
  billing: {
    title: 'Planes y facturación',
    description: 'Administre su suscripción, compare planes y actualice cuando esté listo.',
    pricingTitle: 'Planes y precios',
    pricingSubtitle: 'Compare planes lado a lado. Elija cualquier plan de pago que se ajuste a su espacio.',
    pricingPublicLead:
      'Compare planes lado a lado. Comience gratis o actualice cuando esté listo — las suscripciones se renuevan mensualmente hasta cancelarlas.',
    pricingLoading: 'Cargando planes…',
    planChangeIntro:
      'Las nuevas suscripciones comienzan en Stripe Checkout. Las actualizaciones, degradaciones y cancelaciones usan Gestionar facturación si ya tiene una suscripción.',
    cancelViaPortal:
      'Cancelar mantiene el acceso hasta el final del periodo de facturación actual. Las cancelaciones son finales y no reembolsables.',
    upgradeDowngradeViaPortal:
      'Para actualizar o degradar una suscripción existente, abra Gestionar facturación y cambie su plan en Stripe.',
    openingPortal: 'Abriendo facturación…',
    pricingNav: {
      signIn: 'Iniciar sesión',
      createAccount: 'Crear cuenta',
      dashboard: 'Panel',
      billing: 'Facturación',
      account: 'Cuenta'
    },
    allPlans: 'Todos los planes',
    currentPlan: 'Plan',
    currentPlanBadge: 'Plan actual',
    status: 'Estado',
    renewalDate: 'Fecha de renovación',
    manageStripe: 'Gestionar facturación en Stripe',
    manageBilling: 'Gestionar facturación',
    noCustomer: 'Aún no hay cliente de Stripe. Elija un plan de pago abajo.',
    cancel: 'Cancelar suscripción',
    cancelPlan: 'Cancelar plan',
    resume: 'Reanudar suscripción',
    resumePlan: 'Reanudar plan',
    contactBillingSupport: 'Contactar soporte de facturación',
    planChangesSupport: 'Los cambios de plan se gestionan por soporte de facturación por ahora.',
    alreadySubscribedPortal:
      'Ya tiene una suscripción activa. Use Gestionar facturación para actualizar, degradar o cancelar.',
    downgradeSupportNote: 'Pasar al plan gratuito requiere soporte de facturación.',
    plansFootnote:
      'Las suscripciones se renuevan automáticamente hasta cancelarlas. Todos los pagos son finales y no reembolsables una vez procesados.',
    portalUnavailable: 'La gestión de facturación aún no está configurada.',
    portalNotConfigured: 'La gestión de facturación aún no está configurada.',
    upgradeOptions: 'Opciones de actualización',
    upgrade: 'Actualizar',
    health: {
      title: 'Estado de facturación',
      description: 'Resumen de cómo la facturación de su empresa está conectada y sincronizada.',
      loading: 'Cargando estado de facturación…',
      loadFailed: 'No se pudo cargar el estado de facturación. Inténtelo de nuevo en un momento.',
      currentPlan: 'Plan actual',
      accountStatus: 'Estado de la cuenta',
      technicalDetails: 'Ver detalles técnicos',
      status: {
        connected: 'Conectado',
        needs_attention: 'Requiere atención',
        action_required: 'Acción requerida'
      },
      summary: {
        connected: 'Su facturación está totalmente conectada y sincronizada.',
        needs_attention: 'Algunos elementos de facturación requieren atención. Revise el estado a continuación.',
        action_required: 'La facturación necesita atención antes de que las funciones de pago sean confiables.'
      },
      cards: {
        stripeAccount: {
          connected: {
            title: 'Cuenta de Stripe conectada',
            description: 'Su empresa está vinculada a una cuenta de cliente de Stripe.'
          },
          needs_attention: {
            title: 'La cuenta de Stripe aún no está conectada',
            description: 'Complete el pago o sincronice la facturación para conectar su cuenta de Stripe.'
          },
          action_required: {
            title: 'La cuenta de Stripe aún no está conectada',
            description: 'Complete el pago o sincronice la facturación para conectar su cuenta de Stripe.'
          }
        },
        subscriptionInfo: {
          connected: {
            title: 'La información de suscripción está actualizada',
            description: 'Los detalles de su plan y suscripción están disponibles en EverittOS.'
          },
          needs_attention: {
            title: 'La información de suscripción aún se está sincronizando',
            description: 'Estamos terminando de vincular su plan con Stripe. Suele resolverse después del pago o una sincronización.'
          },
          action_required: {
            title: 'La información de suscripción aún se está sincronizando',
            description: 'Estamos terminando de vincular su plan con Stripe. Suele resolverse después del pago o una sincronización.'
          }
        },
        billingConfiguration: {
          connected: {
            title: 'La configuración de facturación está lista',
            description: 'Las rutas de actualización y precios del plan están disponibles para esta empresa.'
          },
          needs_attention: {
            title: 'La configuración de facturación requiere revisión',
            description: 'Algunos precios de plan aún deben finalizarse. Contacte soporte si las actualizaciones no están disponibles.'
          },
          action_required: {
            title: 'La configuración de facturación requiere revisión',
            description: 'Algunos precios de plan aún deben finalizarse. Contacte soporte si las actualizaciones no están disponibles.'
          }
        },
        subscriptionSync: {
          connected: {
            title: 'Sincronización de suscripción completada',
            description: 'Las actualizaciones de suscripción de Stripe se recibieron correctamente.'
          },
          needs_attention: {
            title: 'La sincronización de suscripción aún no se ha completado',
            description: 'Aún no hemos registrado una sincronización de Stripe completada para esta cuenta. Intente sincronizar de nuevo después del pago.'
          },
          action_required: {
            title: 'La sincronización de suscripción requiere atención',
            description: 'La última sincronización de Stripe no se completó correctamente. Intente sincronizar de nuevo o contacte soporte.'
          }
        },
        billingService: {
          connected: {
            title: 'El servicio de facturación está disponible',
            description: 'EverittOS puede comunicarse con Stripe para esta empresa.'
          },
          needs_attention: {
            title: 'El servicio de facturación requiere atención',
            description: 'La conectividad de facturación es limitada en este momento. Inténtelo de nuevo o contacte soporte.'
          },
          action_required: {
            title: 'El servicio de facturación requiere atención',
            description: 'La conectividad de facturación es limitada en este momento. Inténtelo de nuevo o contacte soporte.'
          }
        }
      },
      technical: {
        profilePlan: 'Plan del perfil (raw)',
        subscriptionStatus: 'Estado de suscripción (raw)',
        stripeCustomerId: 'ID de cliente de Stripe',
        stripeSubscriptionId: 'ID de suscripción de Stripe',
        stripePriceId: 'ID de precio de Stripe',
        latestWebhook: 'Última sincronización webhook',
        notSet: 'No configurado',
        noWebhookYet: 'Aún no hay sincronización webhook',
        webhookSuccess: 'Sincronizado desde {event}',
        webhookFailed: 'Error de sincronización: {reason}',
        unknown: 'desconocido',
        stripeConfigured: 'API de Stripe configurada',
        webhookConfigured: 'Webhook de Stripe configurado',
        checkoutConfigured: 'Precios de checkout configurados',
        yes: 'Sí',
        no: 'No',
        noIssues: 'No se reportaron códigos de diagnóstico internos.'
      }
    },
    promo: {
      label: 'Código promocional',
      applyBeforeCheckout: 'Aplique un código promocional antes de elegir un plan de pago.',
      previewFor: 'Vista previa para',
      placeholder: 'Ingrese código promocional',
      apply: 'Aplicar',
      validating: 'Validando…',
      invalid: 'Este código promocional no es válido.',
      applied: 'Código promocional aplicado: {code}',
      savings: 'Ahorra {amount} por mes',
      expires: 'El código vence el {date}',
      expiresLabel: 'Vence',
      activeTitle: 'Descuento activo',
      couponName: 'Cupón',
      code: 'Código promocional',
      discount: 'Descuento',
      checkoutNote: 'Los descuentos los valida Stripe antes del pago. Los precios se actualizan al aplicar un código.',
      checkoutSuccess: 'Pago completado. Su suscripción se actualizará en breve.',
      checkoutActivated: 'Pago exitoso: su plan ya está activo.',
      checkoutSyncing:
        'Pago recibido, pero la activación del plan aún se está sincronizando. Actualice o contacte soporte si no se actualiza.',
      checkoutInactive: 'Pago fallido o suscripción inactiva.',
      checkoutCancelled: 'El pago fue cancelado. No se realizó ningún cargo.',
      checkoutFailed: 'No se pudo iniciar el pago. Inténtelo de nuevo o contacte soporte.',
      startingCheckout: 'Iniciando pago…',
      applyFirst: 'Aplique un código promocional válido antes del pago.',
      signInNote: '¿Ya tiene una cuenta?'
    },
    noRefund: {
      policyShort: 'Todos los pagos son finales. No hay reembolsos una vez procesado el pago.',
      policyFull:
        'Todos los pagos son finales. EverittOS no ofrece reembolsos por suscripciones, tarifas de configuración, servicios digitales, uso de IA, acceso a la empresa, complementos ni periodos de facturación parcialmente usados. Puede cancelar en cualquier momento para detener renovaciones futuras, pero los cargos previos no son reembolsables.',
      checkoutAck: 'Entiendo que todos los pagos son finales y no reembolsables.',
      ackRequired: 'Confirme la política de no reembolso antes del pago.',
      cancelNote: 'Cancelar solo detiene renovaciones futuras. Los cargos previos no son reembolsables.'
    },
    aiAccess: {
      title: 'Acceso a IA',
      askEverittIncluded: 'La búsqueda Ask Everitt está incluida en todos los planes.',
      everittAiPlans: 'Everitt AI está disponible en los planes Business y Enterprise.',
      includedOnPlan: 'Everitt AI está incluido en su plan {plan}.',
      upgradeCta: 'Actualizar para desbloquear Everitt AI',
      viewUsageLink: 'Ver uso detallado de IA y métricas del equipo'
    }
  },
  aiUsage: {
    title: 'Uso de IA',
    description: 'Recuentos de prompts, costos estimados, seguimiento de cuotas y métricas de uso del equipo para administradores.',
    adminOnly: 'Solo los propietarios y administradores de la empresa pueden ver las métricas de uso de IA.'
  },
  language: {
    title: 'Idioma',
    note: 'El idioma cambia las etiquetas principales. Parte del texto legal y de facturación puede permanecer en inglés.'
  },
  feedback: {
    saved: 'Guardado',
    updated: 'Actualizado',
    created: 'Creado',
    deleted: 'Eliminado',
    sent: 'Enviado',
    submitted: 'Enviado',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    uploadComplete: 'Carga completada',
    syncComplete: 'Sincronización completada',
    copied: 'Copiado',
    removed: 'Eliminado',
    invited: 'Invitación enviada',
    paymentRecorded: 'Pago registrado',
    loading: 'Procesando…',
    genericError: 'Algo salió mal. Inténtelo de nuevo.',
    requestFailed: 'La solicitud falló.'
  },
  pages: {
    invoices: {
      title: 'Facturas',
      subtitle: 'Envíe facturas a los clientes en un paso. El monto y el mensaje se guardan automáticamente.',
      loading: 'Cargando facturas…'
    },
    messages: {
      title: 'Mensajes',
      subtitle: 'Mensajería por correo con el cliente. Los hilos conservan el historial de envíos y fallos.'
    },
    inventory: {
      title: 'Inventario',
      subtitle: 'Controle suministros y equipos. Los ajustes actualizan la cantidad y mantienen un registro.',
      noAccess: 'No tiene acceso al inventario.',
      schemaNotReady: 'Las tablas de inventario aún no están configuradas. Ejecute las migraciones de Supabase y actualice.',
      addItem: 'Agregar artículo',
      close: 'Cerrar',
      name: 'Nombre',
      category: 'Categoría',
      quantity: 'Cantidad',
      unit: 'Unidad',
      reorderLevel: 'Nivel de reorden',
      saveItem: 'Guardar artículo',
      saving: 'Guardando…',
      loading: 'Cargando inventario…',
      empty: 'Aún no hay artículos en inventario.',
      colItem: 'Artículo',
      colQty: 'Cant.',
      colReorder: 'Reorden',
      colLocation: 'Ubicación',
      lowStock: 'Stock bajo',
      adjust: 'Ajustar',
      adjustPlaceholder: '+/-',
      loadError: 'No se pudo cargar el inventario.',
      createError: 'No se pudo crear el artículo.',
      adjustError: 'No se pudo ajustar la cantidad.'
    },
    routes: {
      title: 'Planificación de rutas',
      subtitle: 'Orden básico de trabajos por dirección y agenda. No es optimización de tiempo de viaje.',
      buildRoute: 'Crear ruta',
      building: 'Creando…',
      loading: 'Cargando rutas…',
      empty: 'Aún no hay rutas.',
      colDate: 'Fecha',
      colStatus: 'Estado',
      colStops: 'Paradas',
      view: 'Ver',
      apply: 'Aplicar',
      stopsFor: 'Paradas del {date}',
      missingAddress: 'Sin dirección',
      addressNeeded: 'se necesita dirección',
      applyConfirm: '¿Aplicar este orden de ruta a los trabajos programados?',
      optimizeError: 'No se pudo crear la ruta.',
      applyError: 'No se pudo aplicar la ruta.'
    },
    recurring: {
      title: 'Facturas recurrentes',
      subtitle: 'Genere borradores de facturas según un calendario. No se cobra ni envía automáticamente.',
      schemaNotReady: 'Las tablas de facturas recurrentes aún no están configuradas. Ejecute las migraciones y actualice.',
      addTemplate: 'Agregar plantilla',
      close: 'Cerrar',
      titleField: 'Título',
      amount: 'Monto',
      nextRun: 'Próxima ejecución',
      saveTemplate: 'Guardar plantilla',
      saving: 'Guardando…',
      loading: 'Cargando plantillas recurrentes…',
      empty: 'Aún no hay plantillas de facturas recurrentes.',
      colTitle: 'Título',
      colAmount: 'Monto',
      colCadence: 'Frecuencia',
      colNextRun: 'Próxima ejecución',
      colStatus: 'Estado',
      notSet: 'Sin definir',
      active: 'Activa',
      paused: 'Pausada',
      runNow: 'Ejecutar ahora',
      running: 'Ejecutando…',
      pause: 'Pausar',
      resume: 'Reanudar',
      recentRuns: 'Ejecuciones recientes',
      invoiceCreated: 'Factura creada',
      loadError: 'No se pudieron cargar las facturas recurrentes.',
      createError: 'No se pudo crear la plantilla.',
      updateError: 'No se pudo actualizar la plantilla.',
      runError: 'No se pudo ejecutar la plantilla.',
      draftCreated: 'Borrador de factura creado. Revise la pestaña Borradores arriba.',
      cadence: { weekly: 'Semanal', monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' }
    },
    customerMessages: {
      schemaNotReady: 'Las tablas de mensajería aún no están configuradas. Ejecute las migraciones y actualice.',
      composeTitle: 'Redactar mensaje',
      recipientEmail: 'Correo del destinatario',
      subject: 'Asunto',
      message: 'Mensaje',
      sendEmail: 'Enviar correo',
      sending: 'Enviando…',
      threads: 'Hilos',
      loadingThreads: 'Cargando hilos…',
      emptyThreads: 'Aún no hay hilos de mensajes.',
      colSubject: 'Asunto',
      colStatus: 'Estado',
      colLastMessage: 'Último mensaje',
      open: 'Abrir',
      noSubject: 'Sin asunto',
      thread: 'Hilo',
      reply: 'Responder',
      sendReply: 'Enviar respuesta',
      loadError: 'No se pudieron cargar los mensajes.',
      threadLoadError: 'No se pudo cargar el hilo.',
      sendError: 'No se pudo enviar el mensaje.',
      replyError: 'No se pudo enviar la respuesta.',
      emailFailed: 'El correo falló. El mensaje se guardó con estado fallido.'
    },
    quickbooks: {
      loading: 'Cargando estado de QuickBooks…',
      loadError: 'No se pudo cargar el estado de QuickBooks.',
      statusLabel: 'Estado',
      connected: 'Conectado',
      notConnected: 'No conectado',
      notConfigured: 'Servidor no configurado',
      needsReconnect: 'Necesita volver a conectar',
      company: 'Empresa',
      companyId: 'ID de empresa de QuickBooks',
      lastSync: 'Última sincronización correcta',
      lastError: 'Último error',
      connect: 'Conectar QuickBooks',
      reconnect: 'Volver a conectar QuickBooks',
      disconnect: 'Desconectar QuickBooks',
      recentSyncLog: 'Registro de sincronización reciente',
      noSyncAttempts: 'Aún no hay intentos de sincronización.',
      connectFailed: 'La conexión con QuickBooks falló ({reason}).'
    },
    calendarImport: {
      title: 'Importación de calendario',
      description: 'Crea trabajos automáticamente desde un calendario externo.',
      urlPlaceholder: 'URL de suscripción del calendario',
      helper: 'Pegue un enlace privado de suscripción iCal o ICS.',
      connect: 'Conectar e importar',
      connected: 'Conectado',
      lastSync: 'Última sincronización',
      neverSynced: 'Aún no sincronizado',
      syncNow: 'Sincronizar ahora',
      disconnect: 'Desconectar',
      connecting: 'Conectando…',
      syncing: 'Sincronizando…',
      disconnecting: 'Desconectando…',
      loadError: 'No se pudo cargar el estado de importación del calendario.',
      connectError: 'No se pudo conectar el calendario.',
      syncError: 'No se pudo sincronizar el calendario.',
      disconnectError: 'No se pudo desconectar el calendario.',
      syncResult: '{created} trabajos añadidos, {updated} actualizados, {skipped} ya existían.',
      syncResultFailedOne: 'No se pudo importar {failed} evento.',
      syncResultFailedMany: 'No se pudieron importar {failed} eventos.',
      syncResultFailedOneWithReason: 'No se pudo importar {failed} evento: {reason}.',
      syncResultFailedManyWithReason: 'No se pudieron importar {failed} eventos: {reason}.',
      failureReason: {
        schema_mismatch: 'los campos del trabajo no coinciden con el esquema actual de la base de datos',
        invalid_timezone: 'zona horaria no válida',
        invalid_event_time: 'no se pudo leer la hora de inicio',
        job_insert_failed: 'el evento no se pudo guardar como trabajo',
        job_update_failed: 'no se pudo actualizar el trabajo existente',
        missing_event_uid: 'el evento no tenía una identidad estable',
        duplicate_conflict: 'el evento coincidió con un trabajo existente',
        unsupported_all_day: 'no se pudo importar el evento de día completo'
      },
      lastError: {
        schema_mismatch: 'Los campos del trabajo de calendario no coinciden con el esquema actual de la base de datos.',
        invalid_timezone: 'La zona horaria del trabajo fue rechazada por la base de datos.',
        invalid_event_time: 'No se pudieron importar eventos del calendario porque no se pudo leer su hora de inicio.',
        job_insert_failed: 'No se pudieron guardar los eventos del calendario como trabajos.',
        job_update_failed: 'No se pudieron actualizar los trabajos importados por una restricción de la base de datos.',
        missing_event_uid: 'No se pudieron importar eventos del calendario porque no tenían una identidad estable.',
        duplicate_conflict: 'Los eventos del calendario coincidieron con trabajos existentes y no se modificaron.',
        unsupported_all_day: 'No se pudieron importar los eventos de día completo.'
      }
    },
    duplicateCleanup: {
      title: 'Limpieza de duplicados',
      back: 'Volver a trabajos',
      checking: 'Revisando trabajos recurrentes…',
      none: 'No se encontraron series recurrentes duplicadas.',
      found: '{count} series recurrentes duplicadas encontradas',
      remove: 'Eliminar duplicados',
      removing: 'Eliminando…',
      confirm:
        'Esto eliminará la serie recurrente duplicada y sus visitas futuras, conservando la serie original. Los trabajos históricos completados no se modifican. ¿Continuar?',
      failed: 'No se pudieron revisar los trabajos duplicados.',
      done: 'Se eliminaron los trabajos recurrentes duplicados.',
      noAddress: 'Sin dirección',
      findDuplicates: 'Buscar duplicados'
    },
    customers: { notFound: 'Cliente no encontrado' },
    jobs: {
      notFound: 'Trabajo no encontrado',
      needsAssignment: 'Sin asignar',
      showAll: 'Ver todos los trabajos',
      assignedEmail: 'Correo asignado',
      assignedEmailHint: 'Opcional. Quién debe recibir este trabajo. No se requiere registro en Equipo.',
      createTitle: 'Crear trabajo',
      createPermissionBlocked: 'No tiene acceso para crear trabajos en esta cuenta.',
      restoreJob: 'Restaurar trabajo',
      cancelJob: 'Cancelar trabajo',
      missingCompletionDate: 'Sin fecha de finalización'
    }
  },
  portal: portalMessagesEs
};
