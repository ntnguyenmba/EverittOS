import type { Messages } from '@/lib/i18n/types';

export const messages: Messages = {
  common: {
    continue: 'Tiếp tục',
    skip: 'Bỏ qua',
    skipSetup: 'Bỏ qua thiết lập',
    skipForNow: 'Bỏ qua tạm thời',
    back: 'Quay lại',
    loading: 'Đang tải…',
    connect: 'Kết nối',
    connectLater: 'Kết nối sau',
    addAnother: 'Thêm email khác',
    goToDashboard: 'Đến bảng điều khiển',
    exploreFeatures: 'Khám phá tính năng',
    optional: 'Tùy chọn',
    language: 'Ngôn ngữ'
  },
  onboarding: {
    progress: 'Bước {current} / {total}',
    skipEntire: 'Bỏ qua thiết lập',
    loading: 'Đang tải không gian làm việc…',
    calendarLater: 'Có thể kết nối lịch sau.',
    calendarNotConfigured: 'Kết nối lịch chưa được cấu hình. Bạn có thể tiếp tục và thêm sau trong Cài đặt.',
    calendarConnected: 'Google Calendar đã được kết nối.',
    connectGoogleCalendar: 'Kết nối Google Calendar',
    openIntegrations: 'Mở cài đặt tích hợp',
    inviteFailed: 'Không gửi được lời mời. Bạn có thể mời nhóm sau trong Cài đặt.',
    steps: {
      welcome: {
        title: 'Chào mừng đến EverittOS',
        subtitle:
          'Quản lý công việc, khách hàng, lịch trình, nhân viên và vận hành từ một nơi.'
      },
      business: {
        title: 'Hồ sơ doanh nghiệp',
        subtitle: 'Cho chúng tôi biết về công ty của bạn. Mọi trường đều tùy chọn.',
        companyName: 'Tên công ty',
        industry: 'Ngành',
        teamSize: 'Quy mô nhóm'
      },
      operations: {
        title: 'Thiết lập vận hành',
        subtitle: 'Bạn quản lý những gì? Chọn tất cả phù hợp.'
      },
      team: {
        title: 'Mời nhóm của bạn',
        subtitle: 'Thêm đồng nghiệp ngay hoặc bỏ qua và mời sau. Không bắt buộc trường nào.',
        email: 'Địa chỉ email',
        role: 'Vai trò'
      },
      calendar: {
        title: 'Kết nối lịch của bạn',
        subtitle: 'Đồng bộ công việc đã lên lịch với Google Calendar, hoặc kết nối sau trong Cài đặt.',
        google: 'Google Calendar'
      },
      firstJob: {
        title: 'Tạo công việc đầu tiên',
        subtitle: 'Thêm công việc đầu tiên ngay, hoặc bỏ qua và tạo sau từ bảng điều khiển.',
        jobName: 'Tên công việc',
        customer: 'Khách hàng',
        date: 'Ngày'
      },
      complete: {
        title: 'Không gian làm việc đã sẵn sàng',
        message:
          'Bạn có thể quản lý công việc, khách hàng, lịch trình, nhân viên và vận hành từ bảng điều khiển.'
      }
    },
    industries: {
      property_management: 'Quản lý bất động sản',
      cleaning: 'Vệ sinh',
      salon: 'Salon',
      barber: 'Barber',
      spa: 'Spa',
      beauty_studio: 'Studio làm đẹp',
      maintenance: 'Bảo trì',
      construction: 'Xây dựng',
      general_contractor: 'Nhà thầu tổng',
      landscaping: 'Cảnh quan',
      field_service: 'Dịch vụ hiện trường',
      janitorial: 'Vệ sinh công nghiệp',
      real_estate: 'Bất động sản',
      home_services: 'Dịch vụ tại nhà',
      hospitality: 'Khách sạn & nhà hàng',
      other: 'Khác'
    },
    teamSizes: {
      solo: 'Chỉ tôi',
      small: '2-5',
      medium: '6-20',
      large: '21-50',
      enterprise: '50+'
    },
    operations: {
      jobs: 'Công việc',
      properties: 'Bất động sản',
      customers: 'Khách hàng',
      contractors: 'Nhà thầu',
      workers: 'Nhân viên',
      maintenance: 'Bảo trì',
      cleaning: 'Vệ sinh',
      inspections: 'Kiểm tra',
      other: 'Khác'
    },
    roles: {
      admin: 'Quản trị',
      manager: 'Quản lý',
      worker: 'Nhân viên'
    },
    checklist: {
      title: 'Bắt đầu',
      description:
        'Thiết lập tùy chọn giúp bạn khởi động nhanh hơn. Bỏ qua bất cứ lúc nào. Không chặn công việc của bạn.',
      dismiss: 'Ẩn',
      continue: 'Tiếp tục thiết lập',
      settings: 'Cài đặt không gian',
      steps: [
        'Chào mừng',
        'Hồ sơ doanh nghiệp',
        'Vận hành',
        'Mời nhóm',
        'Lịch',
        'Công việc đầu tiên',
        'Hoàn tất'
      ]
    },
    settings: {
      restart: 'Khởi động lại onboarding',
      restartDescription: 'Thực hiện lại thiết lập từ đầu.',
      restartConfirm: 'Khởi động lại thiết lập?',
      restartSuccess: 'Đã khởi động lại onboarding. Tiếp tục từ màn hình chào mừng.'
    }
  },
  empty: {
    jobs: {
      title: 'Tạo công việc đầu tiên',
      description: 'Theo dõi công việc, lịch, ảnh và báo cáo từ một nơi.',
      action: 'Tạo công việc'
    },
    customers: {
      title: 'Thêm khách hàng đầu tiên',
      description: 'Sắp xếp thông tin liên hệ và lịch sử công việc cho mỗi khách.',
      action: 'Thêm khách hàng'
    },
    schedule: {
      title: 'Tạo nhiệm vụ đã lên lịch đầu tiên',
      description: 'Thêm ngày vào công việc để xem trên lịch và chế độ xem hàng ngày.',
      action: 'Đến công việc'
    },
    workers: {
      title: 'Chưa có nhân viên',
      description: 'Mời thành viên nhóm hoặc thêm nhân viên khi gói của bạn hỗ trợ quản lý đội.',
      action: 'Mời nhóm'
    },
    activity: {
      title: 'Chưa có hoạt động',
      description: 'Cập nhật về công việc, nhóm và báo cáo sẽ hiển thị ở đây.'
    },
    notifications: {
      title: 'Chưa có thông báo',
      description: 'Phân công, lời mời và cập nhật thanh toán sẽ xuất hiện ở đây.'
    },
    workflows: {
      title: 'Chưa có quy trình',
      description: 'Tạo danh sách kiểm tra khi muốn các bước giống nhau cho mọi công việc.'
    },
    photos: {
      title: 'Chưa có ảnh',
      description: 'Tải ảnh trước và sau để ghi lại công việc đã hoàn thành.'
    }
  },
  legal: {
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
    cookies: 'Cookie',
    security: 'Bảo mật',
    footerLabel: 'Pháp lý và chính sách',
    footerNav: 'Liên kết pháp lý'
  },
  cookies: {
    banner: {
      title: 'Tùy chọn cookie',
      description:
        'Chúng tôi dùng cookie thiết yếu cho đăng nhập và bảo mật phiên. Cookie phân tích là tùy chọn.',
      policy: 'Chính sách cookie',
      privacy: 'Chính sách quyền riêng tư',
      acceptAll: 'Chấp nhận tất cả',
      reject: 'Từ chối không thiết yếu',
      manage: 'Quản lý tùy chọn',
      save: 'Lưu tùy chọn'
    },
    categories: {
      necessary: 'Thiết yếu',
      necessaryDesc: 'Bắt buộc cho xác thực và chức năng cốt lõi.',
      analytics: 'Phân tích',
      analyticsDesc: 'Giúp hiểu cách dùng trang đăng ký và marketing.',
      marketing: 'Marketing',
      marketingDesc: 'Dành cho thông báo khuyến mãi trong tương lai.'
    }
  },
  settings: {
    privacy: {
      title: 'Quyền riêng tư & dữ liệu',
      description: 'Kiểm soát dữ liệu, thông báo và tùy chọn tuân thủ.',
      disclosureTitle: 'Dữ liệu chúng tôi thu thập',
      disclosureBody: 'EverittOS chỉ thu thập những gì cần để vận hành không gian làm việc.',
      collectProfile: 'Hồ sơ: email, vai trò, tên doanh nghiệp và cài đặt.',
      collectOperations: 'Dữ liệu vận hành: công việc, khách hàng, nhân viên, lịch và ảnh.',
      collectActivity: 'Nhật ký hoạt động: hành động trong không gian làm việc.',
      collectPasskeys:
        'Passkey (tùy chọn): thông tin xác thực mã hóa trên thiết bị hoặc trình quản lý mật khẩu. EverittOS không nhận hoặc lưu dữ liệu sinh trắc học.',
      retention: 'Dữ liệu được giữ khi tài khoản hoạt động và xóa theo yêu cầu của bạn.',
      preferencesTitle: 'Tùy chọn liên lạc',
      marketingEmails: 'Email marketing',
      productUpdates: 'Cập nhật sản phẩm',
      operationalNotifications: 'Thông báo vận hành',
      doNotSell: 'Không bán hoặc chia sẻ thông tin của tôi',
      doNotSellDesc: 'EverittOS không bán dữ liệu cá nhân. Bật để ghi nhận tùy chọn CCPA.',
      save: 'Lưu tùy chọn',
      saved: 'Đã lưu tùy chọn quyền riêng tư.',
      saveError: 'Không thể lưu tùy chọn.',
      languageTitle: 'Ngôn ngữ',
      exportTitle: 'Tải dữ liệu của bạn',
      exportDescription: 'Xuất hồ sơ, công việc, khách hàng, nhân viên và hoạt động dạng JSON.',
      exportButton: 'Tải xuất dữ liệu',
      exportSuccess: 'Đã bắt đầu xuất dữ liệu.',
      exportError: 'Không thể xuất dữ liệu lúc này.',
      consentTitle: 'Chấp nhận pháp lý',
      termsAccepted: 'Đã chấp nhận điều khoản',
      privacyAccepted: 'Đã chấp nhận quyền riêng tư',
      termsNotRecorded: 'Chưa ghi nhận chấp nhận điều khoản.',
      privacyNotRecorded: 'Chưa ghi nhận chấp nhận quyền riêng tư.'
    },
    notifications: {
      title: 'Thông báo',
      description: 'Chọn cách EverittOS liên hệ với bạn.',
      email: 'Thông báo email',
      operational: 'Cảnh báo vận hành (phân công, hạn, lời mời)',
      push: 'Thông báo đẩy',
      pushFuture: 'Sắp có trên ứng dụng di động.',
      sms: 'Thông báo SMS',
      smsFuture: 'Sắp có khi được hỗ trợ.',
      save: 'Lưu cài đặt thông báo',
      saved: 'Đã lưu cài đặt thông báo.',
      saveError: 'Không thể lưu cài đặt.'
    },
    nav: {
      privacy: 'Quyền riêng tư',
      notifications: 'Thông báo'
    },
    security: {
      passkeysTitle: 'Passkey',
      passkeysBody:
        'Passkey cho phép bạn đăng nhập bằng thiết bị, trình duyệt, trình quản lý mật khẩu, mở khóa sinh trắc học hoặc khóa bảo mật. EverittOS không nhận hoặc lưu dữ liệu sinh trắc học.',
      compromised: 'Nếu bạn cho rằng tài khoản hoặc thiết bị bị xâm phạm, hãy liên hệ'
    }
  },
  auth: {
    acceptTerms: 'Tôi đồng ý với Điều khoản dịch vụ',
    acceptPrivacy: 'Tôi đồng ý với Chính sách quyền riêng tư',
    consentRequired: 'Bạn phải chấp nhận Điều khoản và Chính sách quyền riêng tư để tạo tài khoản.',
    signInMethods: 'Đăng nhập bằng email, Google hoặc passkey.'
  },
  nav: {
    dashboard: 'Bảng điều khiển',
    jobs: 'Công việc',
    customers: 'Khách hàng',
    schedule: 'Lịch',
    workers: 'Nhân viên',
    team: 'Nhóm',
    activity: 'Hoạt động',
    analytics: 'Phân tích',
    workflows: 'Quy trình',
    notifications: 'Thông báo',
    billing: 'Thanh toán',
    settings: 'Cài đặt',
    clientPortal: 'Cổng khách hàng',
    contractorPortal: 'Cổng nhà thầu'
  },
  settingsNav: {
    workspace: 'Không gian làm việc',
    team: 'Nhóm',
    branding: 'Thương hiệu',
    integrations: 'Tích hợp',
    account: 'Tài khoản',
    billing: 'Thanh toán',
    security: 'Bảo mật',
    privacy: 'Quyền riêng tư',
    notifications: 'Thông báo',
    api: 'API',
    departments: 'Phòng ban'
  },
  dashboard: {
    title: 'Bảng điều khiển',
    subtitle: 'Những gì cần chú ý ngay bây giờ.',
    createJob: 'Tạo công việc',
    inviteTeam: 'Mời thành viên',
    viewReports: 'Xem báo cáo',
    upcomingWork: 'Công việc sắp tới',
    quickLinks: 'Liên kết nhanh',
    openJobs: 'Công việc mở',
    completedJobs: 'Đã hoàn thành',
    dueSoon: 'Đến hạn trong 7 ngày',
    reportsOnFile: 'Báo cáo đã lưu',
    teamMembers: 'Thành viên nhóm',
    recentJobs: 'Công việc gần đây',
    upcomingJobs: 'Công việc sắp tới',
    recentActivity: 'Hoạt động gần đây',
    viewAllActivity: 'Xem tất cả hoạt động',
    upgradeTitle: 'Cần giới hạn cao hơn?',
    upgradeBody: 'Nâng cấp để có thêm công việc, ảnh, thành viên nhóm và phân công đội.',
    metricsEmpty: 'Số liệu sẽ hiển thị sau khi bạn tạo công việc, báo cáo và hoạt động nhóm.',
    analyticsEmpty: 'Số liệu sẽ hiển thị sau khi bạn tạo công việc, báo cáo và hoạt động nhóm.'
  },
  billing: {
    title: 'Thanh toán',
    currentPlan: 'Gói',
    status: 'Trạng thái',
    renewalDate: 'Ngày gia hạn',
    manageStripe: 'Quản lý thanh toán trên Stripe',
    noCustomer: 'Chưa có khách hàng Stripe. Chọn gói trả phí bên dưới.',
    cancel: 'Hủy đăng ký',
    resume: 'Tiếp tục đăng ký',
    portalUnavailable: 'Cổng Stripe chưa được cấu hình. Liên hệ hỗ trợ.',
    upgradeOptions: 'Tùy chọn nâng cấp'
  },
  language: {
    title: 'Ngôn ngữ',
    note: 'Ngôn ngữ thay đổi nhãn chính của ứng dụng. Một số văn bản pháp lý và thanh toán có thể vẫn bằng tiếng Anh.'
  }
};
