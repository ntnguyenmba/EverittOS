import type { Messages } from '@/lib/i18n/types';

export const messages: Messages = {
  common: {
    continue: 'Continuar',
    skip: 'Omitir',
    skipSetup: 'Omitir configuración',
    skipForNow: 'Omitir por ahora',
    back: 'Atrás',
    loading: 'Cargando…',
    connect: 'Conectar',
    connectLater: 'Conectar después',
    addAnother: 'Agregar otro',
    goToDashboard: 'Ir al panel',
    exploreFeatures: 'Explorar funciones',
    createSampleJob: 'Crear trabajo de ejemplo',
    optional: 'Opcional',
    language: 'Idioma'
  },
  onboarding: {
    progress: 'Paso {current} de {total}',
    skipEntire: 'Omitir configuración',
    loading: 'Cargando su espacio de trabajo…',
    calendarLater: 'La integración del calendario se puede conectar más tarde.',
    inviteFailed: 'No se pudo enviar la invitación. Puede invitar al equipo desde Configuración.',
    sampleJobName: 'Visita de bienvenida',
    sampleCustomer: 'Cliente de ejemplo',
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
        subtitle: 'Agregue un trabajo real, cree un ejemplo u omita y comience desde el panel.',
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
      maintenance: 'Mantenimiento',
      construction: 'Construcción',
      landscaping: 'Paisajismo',
      field_service: 'Servicio de campo',
      hospitality: 'Hospitalidad',
      other: 'Otro'
    },
    teamSizes: {
      solo: 'Solo yo',
      small: '2–5',
      medium: '6–20',
      large: '21–50',
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
        'Configuración opcional para ayudarle a comenzar más rápido. Omita cuando quiera — nada bloquea su trabajo.',
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
      restart: 'Reiniciar onboarding',
      restartDescription: 'Repita la configuración desde el inicio.',
      restartConfirm: '¿Reiniciar configuración?',
      restartSuccess: 'Onboarding reiniciado. Continúe desde la pantalla de bienvenida.'
    }
  },
  empty: {
    jobs: {
      title: 'Cree su primer trabajo',
      description: 'Gestione trabajo, horarios, fotos e informes desde un solo lugar.',
      action: 'Crear trabajo'
    },
    customers: {
      title: 'Agregue su primer cliente',
      description: 'Organice contactos e historial de trabajos para cada cliente.',
      action: 'Agregar cliente'
    },
    schedule: {
      title: 'Cree su primera tarea programada',
      description: 'Agregue fechas a los trabajos para verlos en el calendario.',
      action: 'Ir a trabajos'
    },
    workers: {
      title: 'Invite a su primer miembro del equipo',
      description: 'Asigne trabajo y mantenga a todos alineados desde el campo u oficina.',
      action: 'Invitar equipo'
    },
    activity: {
      title: 'Sin actividad aún',
      description: 'Las actualizaciones de trabajos, equipo e informes aparecerán aquí.'
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
  }
};
