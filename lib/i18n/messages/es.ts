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
    close: 'Cerrar'
  },
  ux: {
    appName: 'EverittOS',
    mobileNavLabel: 'Navegación principal',
    logOut: 'Cerrar sesión',
    startPro: 'Empezar Pro',
    attentionNeeded: 'Requiere atención',
    progressTitle: 'Su progreso',
    advancedTools: 'Más herramientas',
    helperSchedule: 'Vea el calendario y asigne trabajo.',
    helperAnalytics: 'Rendimiento y tendencias de su espacio de trabajo.',
    helperBilling: 'Facturas, pagos y su suscripción.',
    pageTitles: {
      schedule: 'Calendario y trabajo',
      analytics: 'Rendimiento del negocio',
      billing: 'Facturas y pagos'
    }
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
      description: '',
      action: 'Nuevo trabajo'
    },
    customers: {
      title: 'Sin clientes aún',
      description: '',
      action: 'Agregar cliente'
    },
    schedule: {
      title: 'Sin programación',
      description: '',
      action: 'Ver trabajos'
    },
    workers: {
      title: 'Sin trabajadores aún',
      description: '',
      action: 'Invitar equipo'
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
      title: 'Sin fotos aún',
      description: 'Suba fotos de antes y después para documentar el trabajo completado.'
    }
  },
  legal: {
    terms: 'Términos',
    privacy: 'Privacidad',
    cookies: 'Cookies',
    security: 'Seguridad',
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
        'Llaves de acceso (opcional): credenciales criptográficas en su dispositivo o gestor de contraseñas. EverittOS no recibe ni almacena datos biométricos.',
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
      passkeysBody:
        'Las llaves de acceso le permiten iniciar sesión con su dispositivo, navegador, gestor de contraseñas, desbloqueo biométrico o llave de seguridad. EverittOS no recibe ni almacena datos biométricos.',
      compromised: 'Si cree que su cuenta o dispositivo se ha visto comprometido, contáctenos en'
    }
  },
  auth: {
    acceptTerms: 'Acepto los Términos de servicio',
    acceptPrivacy: 'Acepto la Política de privacidad',
    consentRequired: 'Debe aceptar los Términos y la Política de privacidad para crear una cuenta.',
    signInMethods: 'Inicie sesión con correo, Google o llave de acceso.'
  },
  nav: {
    today: 'Hoy',
    more: 'Más',
    commandCenter: 'Hoy',
    dashboard: 'Panel',
    forms: 'Formularios',
    templates: 'Plantillas',
    reviews: 'Reseñas',
    leads: 'Prospectos',
    jobs: 'Trabajos',
    crm: 'CRM',
    customers: 'Clientes',
    projects: 'Proyectos',
    knowledge: 'Conocimiento',
    automations: 'Automatizaciones',
    clients: 'Clientes portal',
    schedule: 'Horario',
    workers: 'Trabajadores',
    team: 'Equipo',
    activity: 'Actividad',
    analytics: 'Analítica',
    workflows: 'Flujos',
    notifications: 'Notificaciones',
    billing: 'Facturación',
    settings: 'Configuración',
    clientPortal: 'Portal del cliente',
    contractorPortal: 'Portal del contratista'
  },
  settingsNav: {
    workspace: 'Espacio de trabajo',
    team: 'Equipo',
    branding: 'Marca',
    integrations: 'Integraciones',
    account: 'Cuenta',
    billing: 'Facturación',
    security: 'Seguridad',
    privacy: 'Privacidad',
    notifications: 'Notificaciones',
    api: 'API',
    aiMemory: 'Memoria IA',
    departments: 'Departamentos'
  },
  dashboard: {
    title: 'Hoy',
    subtitle: 'Lo que necesita su atención ahora.',
    welcome: 'Bienvenido de nuevo',
    welcomeName: 'Bienvenido de nuevo, {name}',
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
      scheduledUpcoming: 'Programados adelante'
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
      leadsClients: '{leads} prospectos · {clients} clientes'
    },
    todaysSchedule: 'Horario de hoy',
    viewSchedule: 'Horario',
    noScheduleToday: 'Nada programado hoy',
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
    analyticsEmpty: 'Sin métricas aún'
  },
  billing: {
    title: 'Facturación',
    currentPlan: 'Plan',
    status: 'Estado',
    renewalDate: 'Fecha de renovación',
    manageStripe: 'Gestionar facturación en Stripe',
    noCustomer: 'Aún no hay cliente de Stripe. Elija un plan de pago abajo.',
    cancel: 'Cancelar suscripción',
    resume: 'Reanudar suscripción',
    portalUnavailable: 'El portal de Stripe no está configurado. Contacte soporte.',
    upgradeOptions: 'Opciones de actualización'
  },
  language: {
    title: 'Idioma',
    note: 'El idioma cambia las etiquetas principales. Parte del texto legal y de facturación puede permanecer en inglés.'
  }
};
