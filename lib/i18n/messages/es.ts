import type { Messages } from '@/lib/i18n/types';

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
          'Gestione trabajos, clientes, horarios, trabajadores y operaciones desde un solo lugar.'
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
          'Ahora puede gestionar trabajos, clientes, horarios, trabajadores y operaciones desde su panel.'
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
      general_contractor: 'Contratista general',
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
      contractors: 'Contratistas',
      workers: 'Trabajadores',
      maintenance: 'Mantenimiento',
      cleaning: 'Limpieza',
      inspections: 'Inspecciones',
      other: 'Otro'
    },
    roles: {
      admin: 'Administrador',
      manager: 'Gerente',
      worker: 'Trabajador'
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
      title: 'Sin trabajadores aún',
      description: 'Agregue miembros del equipo para asignar trabajos.',
      action: 'Agregar trabajador'
    },
    activity: {
      title: 'Sin actividad aún',
      description: ''
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
      collectOperations: 'Datos operativos: trabajos, clientes, trabajadores, horarios y fotos.',
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
      exportDescription: 'Exporte perfil, trabajos, clientes, trabajadores y actividad en JSON.',
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
      pushFuture: 'Próximamente en apps móviles.',
      sms: 'Notificaciones SMS',
      smsFuture: 'Próximamente donde esté disponible.',
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
      workspaceSettings: 'Configuración del espacio',
      subscription: 'Suscripción',
      subscriptionNote: 'Cancele, reanude o cambie planes desde facturación.',
      subscriptionOwnerOnly: 'Solo propietarios y administradores pueden cambiar la facturación.',
      openBilling: 'Abrir facturación',
      languageTitle: 'Idioma',
      languageNote: 'Aplica a navegación, panel, trabajos, clientes, reservas, trabajadores, horario, facturación y ajustes.',
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
    clients: 'Clientes portal',
    schedule: 'Horario',
    expenses: 'Gastos',
    workers: 'Trabajadores',
    team: 'Equipo',
    activity: 'Actividad',
    analytics: 'Analítica',
    workflows: 'Flujos',
    notifications: 'Notificaciones',
    billing: 'Planes y facturación',
    settings: 'Configuración',
    clientPortal: 'Portal del cliente',
    contractorPortal: 'Portal del contratista',
    sectionTools: 'Herramientas',
    sectionInsights: 'Información'
  },
  settingsNav: {
    workspace: 'Espacio de trabajo',
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
      'Reserve una llamada gratuita de incorporación de 30 minutos y le ayudaremos a configurar sus primeros clientes, trabajos, trabajadores, horario, facturas y SOP.',
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
      'Reserve una llamada gratuita de incorporación de 30 minutos y le ayudaremos a configurar sus primeros clientes, trabajos, trabajadores, horario, facturas y SOP.',
    settingsTitle: 'Soporte y capacitación',
    settingsDescription: 'Incorporación, configuración de SOP y capacitación de equipo con el equipo Everitt.',
    settingsEmailNote: 'También puede escribirnos a',
    contactEverittTeam: 'Contactar al equipo Everitt'
  },
  dashboard: {
    title: 'Hoy',
    subtitle: 'Lo que necesita su atención ahora.',
    welcome: 'Bienvenido de nuevo',
    welcomeName: 'Bienvenido de nuevo, {name}',
    subtitleToday: 'Esto es lo que ocurre hoy.',
    newJob: 'Nuevo trabajo',
    quickActions: {
      createJob: 'Crear trabajo',
      addCustomer: 'Agregar cliente',
      sendInvoice: 'Enviar factura',
      scheduleWork: 'Programar trabajo',
      addWorker: 'Agregar trabajador'
    },
    attention: {
      overdueInvoices: 'Facturas sin pagar',
      unassignedJobs: 'Trabajos sin trabajador',
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
    businessActivity: 'Actividad comercial reciente',
    businessActivityEmpty:
      'Aún no hay actividad comercial. Crea tu primer cliente, prospecto o trabajo para comenzar.',
    revenue: {
      title: 'Resumen de ingresos',
      revenueMonth: 'Ingresos del mes',
      outstanding: 'Facturas pendientes',
      jobsCompleted: 'Trabajos completados',
      activeCustomers: 'Clientes activos',
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
      workers: 'Trabajadores',
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
    analyticsEmpty: 'Las métricas aparecerán después de crear trabajos, informes y actividad del equipo.'
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
    openingPortal: 'Abriendo portal de facturación…',
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
    portalUnavailable: 'El portal de facturación aún no está configurado.',
    portalNotConfigured: 'El portal de facturación aún no está configurado.',
    upgradeOptions: 'Opciones de actualización',
    upgrade: 'Actualizar',
    health: {
      title: 'Estado de facturación',
      description: 'Resumen de cómo la facturación de su workspace está conectada y sincronizada.',
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
            description: 'Su workspace está vinculado a una cuenta de cliente de Stripe.'
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
            description: 'Las rutas de actualización y precios del plan están disponibles para este workspace.'
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
            description: 'EverittOS puede comunicarse con Stripe para este workspace.'
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
        'Todos los pagos son finales. EverittOS no ofrece reembolsos por suscripciones, tarifas de configuración, servicios digitales, uso de IA, acceso al workspace, complementos ni periodos de facturación parcialmente usados. Puede cancelar en cualquier momento para detener renovaciones futuras, pero los cargos previos no son reembolsables.',
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
    adminOnly: 'Solo los propietarios y administradores del workspace pueden ver las métricas de uso de IA.'
  },
  language: {
    title: 'Idioma',
    note: 'El idioma cambia las etiquetas principales. Parte del texto legal y de facturación puede permanecer en inglés.'
  }
};
