import type { Messages } from '@/lib/i18n/types';
import { portalMessagesVi } from '@/lib/i18n/portal-messages';

export const messages: Messages = {
  common: {
    continue: 'Tiếp tục',
    skip: 'Bỏ qua',
    skipThisStep: 'Bỏ qua bước này',
    skipAllSetup: 'Bỏ qua toàn bộ thiết lập',
    cancelSetup: 'Hủy thiết lập',
    back: 'Quay lại',
    loading: 'Đang tải…',
    connect: 'Kết nối',
    connectLater: 'Kết nối sau',
    addAnother: 'Thêm email khác',
    goToDashboard: 'Đến bảng điều khiển',
    exploreFeatures: 'Khám phá tính năng',
    optional: 'Tùy chọn',
    language: 'Ngôn ngữ',
    close: 'Đóng',
    cancel: 'Hủy'
  },
  ux: {
    appName: 'EverittOS',
    mobileNavLabel: 'Điều hướng chính',
    logOut: 'Đăng xuất',
    startPro: 'Bắt đầu Pro',
    viewPlans: 'Xem gói',
    attentionNeeded: 'Cần chú ý',
    progressTitle: 'Tiến độ của bạn',
    advancedTools: 'Công cụ khác',
    helperSchedule: 'Xem lịch và phân công công việc.',
    helperAnalytics: 'Hiệu suất và xu hướng kinh doanh.',
    helperBilling: 'Hóa đơn, thanh toán và gói đăng ký.',
    pageTitles: {
      schedule: 'Lịch & công việc',
      analytics: 'Hiệu suất kinh doanh',
      billing: 'Hóa đơn & thanh toán',
      customers: 'Theo dõi khách hàng, khách tiềm năng và việc cần làm ở một nơi.'
    },
    tapHint: 'Chạm để xem chi tiết'
  },
  onboarding: {
    progress: 'Bước {current} / {total}',
    loading: 'Đang tải không gian làm việc…',
    calendarLater: 'Có thể kết nối lịch sau.',
    calendarNotConfigured: 'Kết nối lịch chưa được cấu hình. Bạn có thể tiếp tục và thêm sau trong Cài đặt.',
    calendarConnected: 'Google Calendar đã được kết nối.',
    connectGoogleCalendar: 'Kết nối Google Calendar',
    openIntegrations: 'Mở cài đặt tích hợp',
    inviteFailed: 'Không gửi được lời mời. Bạn có thể mời nhóm sau trong Cài đặt.',
    teamUpgradeRequired: 'Mời nhóm cần gói Business trở lên. Nâng cấp trong Thanh toán.',
    inviteLinkReady: 'Đã tạo lời mời. Sao chép liên kết bên dưới vì email chưa được cấu hình.',
    inviteLinkCopied: 'Đã sao chép liên kết mời.',
    copyInviteLink: 'Sao chép liên kết mời',
    steps: {
      welcome: {
        title: 'Chào mừng đến EverittOS',
        subtitle:
          'Quản lý công việc, khách hàng, lịch trình, mọi người và vận hành từ một nơi.'
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
          'Bạn có thể quản lý công việc, khách hàng, lịch trình, mọi người và vận hành từ bảng điều khiển.'
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
      general_contractor: 'Nhân viên tổng',
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
      contractors: 'Nhân viên',
      workers: 'Nhóm',
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
      restart: 'Khởi động lại thiết lập',
      restartDescription: 'Thực hiện lại thiết lập từ đầu.',
      restartConfirm: 'Khởi động lại thiết lập?',
      restartSuccess: 'Đã khởi động lại thiết lập. Tiếp tục từ màn hình chào mừng.'
    }
  },
  empty: {
    jobs: {
      title: 'Chưa có công việc',
      description: 'Tạo việc đầu tiên để bắt đầu theo dõi công việc.',
      action: 'Tạo việc'
    },
    customers: {
      title: 'Chưa có khách hàng',
      description: 'Thêm khách đầu tiên để theo dõi việc, ghi chú, hóa đơn và theo dõi.',
      action: 'Thêm khách'
    },
    leads: {
      title: 'Chưa có khách tiềm năng',
      description: 'Thu thập khách tiềm năng đầu tiên để theo dõi nguồn và chuyển đổi.',
      action: 'Thêm khách tiềm năng',
      secondaryAction: 'Tạo biểu mẫu'
    },
    schedule: {
      title: 'Chưa có lịch',
      description: 'Lên lịch hẹn đầu tiên để xem công việc trên lịch.',
      action: 'Lên lịch'
    },
    workers: {
      title: 'Chưa có thành viên nhóm',
      description: 'Mời thành viên nhóm để giao việc và quản lý quyền truy cập.',
      action: 'Mời thành viên nhóm'
    },
    activity: {
      title: 'Chưa có hoạt động',
      description: 'Hoạt động từ công ty của bạn sẽ xuất hiện tại đây.'
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
      title: 'Chưa có ảnh trước/sau',
      description: 'Tải ảnh trước và sau để ghi lại công việc đã hoàn thành.'
    },
    reviews: {
      title: 'Chưa có đánh giá',
      description: 'Gửi yêu cầu đánh giá sau khi hoàn thành công việc.',
      action: 'Gửi yêu cầu đánh giá'
    },
    forms: {
      title: 'Chưa có biểu mẫu',
      description: 'Tạo biểu mẫu để thu thập khách tiềm năng từ website.',
      action: 'Tạo biểu mẫu'
    },
    templates: {
      title: 'Chưa có mẫu',
      description: 'Lưu đề xuất, SOP và email tái sử dụng cho nhóm.',
      action: 'Mẫu mới'
    },
    expenses: {
      title: 'Chưa có chi phí',
      description: 'Theo dõi chi phí theo công việc để hiểu lợi nhuận.',
      action: 'Thêm chi phí'
    },
    invoices: {
      title: 'Chưa có hóa đơn',
      description: 'Gửi hóa đơn đầu tiên để thu tiền cho công việc đã hoàn thành.',
      action: 'Gửi hóa đơn'
    },
    analytics: {
      title: 'Chưa có phân tích',
      description: 'Tạo khách, việc và hóa đơn để xem thông tin doanh thu.',
      action: 'Đến bảng điều khiển'
    }
  },
  legal: {
    terms: 'Điều khoản',
    privacy: 'Quyền riêng tư',
    termsOfService: 'Điều khoản dịch vụ',
    privacyPolicy: 'Chính sách quyền riêng tư',
    refundPolicy: 'Chính sách không hoàn tiền',
    cookies: 'Cookie',
    security: 'Bảo mật',
    support: 'Hỗ trợ',
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
      collectOperations: 'Dữ liệu vận hành: công việc, khách hàng, mọi người, lịch và ảnh.',
      collectActivity: 'Nhật ký hoạt động: hành động trong không gian làm việc.',
      collectPasskeys:
        'Passkey chưa được bật. Nếu thêm sau này, thông tin xác thực sẽ ở trên thiết bị của bạn.',
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
      exportDescription: 'Xuất hồ sơ, công việc, khách hàng, mọi người và hoạt động dạng JSON.',
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
      pushFuture: 'Chưa khả dụng trong bản phát hành này.',
      sms: 'Thông báo SMS',
      smsFuture: 'Chưa khả dụng trong bản phát hành này.',
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
      passkeysBody: 'Thêm passkey để đăng nhập nhanh và an toàn hơn trên thiết bị hỗ trợ.',
      compromised: 'Nếu bạn cho rằng tài khoản hoặc thiết bị bị xâm phạm, hãy liên hệ'
    },
    account: {
      description: 'Email, vai trò, đăng ký và trạng thái tài khoản.',
      profile: 'Hồ sơ',
      email: 'Email',
      role: 'Vai trò',
      accountStatus: 'Trạng thái tài khoản',
      active: 'Đang hoạt động',
      disabled: 'Đã vô hiệu hóa',
      manageBilling: 'Quản lý thanh toán',
      workspaceSettings: 'Cài đặt công ty',
      subscription: 'Đăng ký',
      subscriptionNote: 'Hủy, tiếp tục hoặc đổi gói trong cài đặt thanh toán.',
      subscriptionOwnerOnly: 'Chỉ chủ sở hữu và quản trị viên mới có thể thay đổi thanh toán.',
      openBilling: 'Mở cài đặt thanh toán',
      languageTitle: 'Ngôn ngữ',
      languageNote: 'Áp dụng cho điều hướng, bảng điều khiển, công việc, khách hàng, lịch hẹn, nhân sự, lịch, thanh toán và cài đặt.',
      disableTitle: 'Vô hiệu hóa tài khoản',
      disableNote:
        'Vô hiệu hóa sẽ đăng xuất và chặn đăng nhập. Dữ liệu tổ chức được giữ nguyên. Không có gì bị xóa.',
      ownerDisableWarning: 'Bạn là chủ sở hữu không gian. Vô hiệu hóa chỉ chặn tài khoản của bạn. Chuyển quyền sở hữu tại',
      restoreContact: 'Liên hệ hỗ trợ để khôi phục quyền truy cập:',
      disabling: 'Đang vô hiệu hóa…',
      disableConfirmTitle: 'Vô hiệu hóa tài khoản?',
      disableConfirmBody: 'Bạn sẽ bị đăng xuất và không thể truy cập các trang được bảo vệ cho đến khi hỗ trợ khôi phục.',
      disableFailed: 'Không thể vô hiệu hóa tài khoản.',
      disabledDetail: 'Tài khoản đã được vô hiệu hóa theo yêu cầu của bạn.'
    }
  },
  analytics: {
    adoption: 'Chỉ số áp dụng',
    growth: 'Chỉ số tăng trưởng',
    usage: 'Chỉ số sử dụng'
  },
  auth: {
    acceptTerms: 'Tôi đồng ý với Điều khoản dịch vụ',
    acceptPrivacy: 'Tôi đồng ý với Chính sách quyền riêng tư',
    acceptTermsAndPrivacy: 'Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư',
    agreeToTermsPrefix: 'Tôi đồng ý với',
    agreeToTermsAnd: 'và',
    continuingLegalPrefix: 'Khi tiếp tục, bạn đồng ý với',
    continuingLegalAcknowledge: ', xác nhận',
    continuingLegalUnderstand: ' và hiểu',
    consentRequired: 'Bạn phải chấp nhận Điều khoản và Chính sách quyền riêng tư để tạo tài khoản.',
    signInMethods: 'Đăng nhập bằng email và mật khẩu, hoặc dùng passkey nếu đã thêm.',
    signUpMethods: 'Tạo tài khoản bằng email và mật khẩu. Bạn có thể thêm passkey sau khi đăng ký.'
  },
  nav: {
    today: 'Hôm nay',
    money: 'Tiền',
    more: 'Thêm',
    commandCenter: 'Dashboard',
    dashboard: 'Bảng điều khiển',
    forms: 'Biểu mẫu',
    templates: 'Mẫu',
    reviews: 'Đánh giá',
    proposals: 'Đề xuất',
    estimates: 'Báo giá',
    invoices: 'Hóa đơn',
    messages: 'Tin nhắn',
    leads: 'Khách tiềm năng',
    services: 'Dịch vụ',
    bookings: 'Lịch hẹn',
    jobs: 'Công việc',
    crm: 'Khách hàng',
    customers: 'Khách hàng',
    projects: 'Dự án',
    knowledge: 'Tri thức',
    automations: 'Tự động hóa',
    clients: 'Khách hàng',
    schedule: 'Lịch',
    expenses: 'Chi phí',
    workers: 'Nhóm',
    team: 'Nhóm',
    activity: 'Hoạt động',
    analytics: 'Phân tích',
    workflows: 'Quy trình',
    notifications: 'Thông báo',
    billing: 'Gói & thanh toán',
    settings: 'Cài đặt',
    clientPortal: 'Bảng điều khiển khách hàng',
    contractorPortal: 'Bảng điều khiển nhân viên',
    sectionTools: 'Công cụ',
    sectionInsights: 'Phân tích',
    inventory: 'Kho hàng',
    routes: 'Tuyến đường',
    photos: 'Ảnh'
  },
  settingsNav: {
    workspace: 'Công ty',
    team: 'Nhóm',
    branding: 'Thương hiệu',
    integrations: 'Tích hợp',
    account: 'Tài khoản',
    billing: 'Gói & thanh toán',
    security: 'Bảo mật',
    privacy: 'Quyền riêng tư',
    notifications: 'Thông báo',
    supportTraining: 'Hỗ trợ & đào tạo',
    api: 'API',
    aiMemory: 'Bộ nhớ AI',
    aiUsage: 'Sử dụng AI',
    departments: 'Phòng ban'
  },
  supportTraining: {
    pricingHeadline: 'Cần hỗ trợ bắt đầu?',
    pricingBody:
      'Đặt cuộc gọi onboarding miễn phí 30 phút và chúng tôi sẽ giúp bạn thiết lập khách hàng, công việc, nhân sự, lịch, hóa đơn và SOP đầu tiên.',
    itemOnboardingCall: 'Cuộc gọi onboarding miễn phí 30 phút',
    itemSopSetup: 'Hỗ trợ thiết lập SOP',
    itemTeamTraining: 'Đào tạo nhóm có sẵn',
    bookOnboardingCall: 'Đặt cuộc gọi onboarding miễn phí',
    welcomeTitle: 'Chào mừng đến EverittOS.',
    welcomeBody:
      'Cần hỗ trợ bắt đầu? Đặt cuộc gọi onboarding miễn phí 30 phút và chúng tôi sẽ giúp cấu hình tài khoản của bạn.',
    bookFreeCall: 'Đặt cuộc gọi miễn phí',
    dashboardTitle: 'Cần hỗ trợ thiết lập EverittOS?',
    dashboardBody:
      'Đặt cuộc gọi onboarding miễn phí 30 phút và chúng tôi sẽ giúp bạn thiết lập khách hàng, công việc, nhân sự, lịch, hóa đơn và SOP đầu tiên.',
    settingsTitle: 'Hỗ trợ & đào tạo',
    settingsDescription: 'Onboarding, thiết lập SOP và đào tạo nhóm từ đội ngũ Everitt.',
    settingsEmailNote: 'Bạn cũng có thể gửi email cho chúng tôi tại',
    contactEverittTeam: 'Liên hệ đội Everitt'
  },
  dashboard: {
    title: 'Hôm nay',
    subtitle: 'Những việc cần làm ngay bây giờ.',
    navSubtitle: 'Dùng menu hoặc Ask Everitt để mở khách hàng, công việc, ảnh, lịch, hóa đơn, nhóm và cài đặt.',
    helpAriaLabel: 'Hỗ trợ EverittOS',
    welcome: 'Chào mừng trở lại',
    welcomeName: 'Chào mừng trở lại, {name}',
    subtitleToday: 'Đây là những gì đang diễn ra hôm nay.',
    newJob: 'Công việc mới',
    quickActions: {
      createJob: 'Tạo việc',
      addCustomer: 'Thêm khách',
      sendInvoice: 'Gửi hóa đơn',
      scheduleWork: 'Lên lịch',
      addWorker: 'Mời người'
    },
    attention: {
      overdueInvoices: 'Hóa đơn chưa trả',
      unassignedJobs: 'Việc chưa giao',
      pendingEstimates: 'Báo giá đang mở',
      followUpCustomers: 'Khách cần theo dõi',
      upcomingAppointments: 'Lịch hẹn sắp tới'
    },
    progress: {
      completedWeek: 'Hoàn thành tuần này',
      revenueMonth: 'Đã thu tháng này',
      newCustomersMonth: 'Khách mới tháng này',
      openInvoices: 'Hóa đơn mở',
      scheduledUpcoming: 'Đã lên lịch',
      hints: {
        completedWeek: 'Chạm để xem việc đã hoàn thành',
        revenueMonth: 'Chạm để xem thanh toán',
        newCustomersMonth: 'Chạm để xem khách mới',
        openInvoices: 'Chạm để xem hóa đơn mở',
        scheduledUpcoming: 'Chạm để xem lịch sắp tới'
      }
    },
    sidebar: {
      todayTasks: 'Việc hôm nay',
      notifications: 'Thông báo',
      upcoming: 'Sắp tới',
      crmSnapshot: 'Tóm tắt CRM',
      viewTasks: 'Xem việc',
      openInbox: 'Mở hộp thư',
      openSchedule: 'Mở lịch',
      openCrm: 'Mở CRM',
      leadsClients: '{leads} khách tiềm năng · {clients} khách',
      hints: {
        todayTasks: 'Chạm để xem việc đang mở',
        notifications: 'Chạm để mở hộp thư',
        upcoming: 'Chạm để xem lịch',
        crmSnapshot: 'Chạm để mở khách hàng'
      }
    },
    todaysSchedule: 'Lịch hôm nay',
    viewSchedule: 'Lịch',
    noScheduleToday: 'Không có lịch hôm nay',
    upcomingJobs: 'Công việc sắp tới',
    noUpcomingJobs: 'Không có công việc nào trong hai tuần tới.',
    customersAndLeads: 'Khách hàng & tiềm năng',
    noCustomersOrLeads: 'Chưa có khách hàng hoặc tiềm năng. Thêm mục đầu tiên để bắt đầu.',
    myWork: 'Công việc của tôi',
    myWorkSubtitle: 'Hôm nay, việc được giao, liên hệ khách và thao tác hiện trường.',
    crm: {
      openLeads: 'Tiềm năng đang mở',
      openLeadsHelp: 'Mới, đã liên hệ, đủ điều kiện, đề xuất và mở lại.',
      closedLeads: 'Tiềm năng đã đóng',
      closedLeadsHelp: 'Thắng, thua và đã hủy.',
      activeCustomers: 'Khách hàng đang hoạt động',
      activeCustomersHelp: 'Khách hàng hiện đang hoạt động trong không gian làm việc.',
      recurringCustomers: 'Khách hàng định kỳ',
      recurringCustomersHelp: 'Khách hàng được đánh dấu là tài khoản dịch vụ định kỳ.',
      inactiveCustomers: 'Khách hàng không hoạt động',
      inactiveCustomersHelp: 'Khách hàng không hoạt động và khách cũ.'
    },
    businessActivity: 'Hoạt động kinh doanh gần đây',
    businessActivityEmpty:
      'Chưa có hoạt động kinh doanh. Tạo khách hàng, tiềm năng hoặc công việc đầu tiên để bắt đầu.',
    revenue: {
      title: 'Tóm tắt doanh thu',
      revenueMonth: 'Doanh thu tháng này',
      outstanding: 'Hóa đơn chưa thu',
      overdueInvoices: 'Hóa đơn quá hạn',
      jobsCompleted: 'Công việc hoàn thành',
      completedThisMonth: 'Hoàn thành tháng này',
      upcomingJobs: 'Công việc sắp tới',
      activeCustomers: 'Khách hàng hoạt động',
      expensesMonth: 'Chi phí tháng này',
      netEstimate: 'Ước tính ròng',
      bookingsMonth: 'Đặt lịch tháng này',
      messagesCount: 'Tin nhắn',
      reportsCount: 'Báo cáo',
      viewAnalytics: 'Phân tích'
    },
    primaryActions: 'Thao tác nhanh',
    metricsLabel: 'Tổng quan',
    recentActivity: 'Hoạt động gần đây',
    viewActivity: 'Xem tất cả',
    moreDetails: 'Gói và sử dụng',
    finishSetup: 'Hoàn tất thiết lập',
    actions: {
      newJob: 'Công việc mới',
      schedule: 'Lịch',
      customers: 'Khách hàng',
      workers: 'Nhóm',
      billing: 'Thanh toán'
    },
    metrics: {
      jobsToday: 'Việc hôm nay',
      openJobs: 'Việc đang mở',
      completedJobs: 'Việc đã hoàn thành',
      dueInSevenDays: 'Đến hạn trong 7 ngày',
      reports: 'Báo cáo',
      teamMembers: 'Thành viên nhóm',
      unpaidInvoices: 'Hóa đơn chưa trả',
      upcomingSchedule: 'Sắp tới'
    },
    quickLinksLabel: 'Thêm',
    quickLinks: {
      jobs: 'Việc',
      notifications: 'Thông báo',
      settings: 'Cài đặt',
      activity: 'Hoạt động'
    },
    activityEmpty: 'Chưa có hoạt động',
    skipped: {
      label: 'Còn lại:',
      createJob: 'Tạo việc',
      addCustomer: 'Thêm khách',
      inviteTeam: 'Mời nhóm',
      connectCalendar: 'Kết nối lịch'
    },
    metricsEmpty: 'Chưa có số liệu',
    analyticsEmpty: 'Số liệu sẽ xuất hiện sau khi tạo công việc, báo cáo và hoạt động nhóm.',
    teamCommand: {
      ariaLabel: 'Trung tâm điều phối nhóm',
      title: 'Trung tâm điều phối nhóm',
      subtitle: 'Xem ai đang sẵn sàng, đã lên lịch hoặc cần chú ý hôm nay.',
      loading: 'Đang tải trung tâm điều phối nhóm...',
      loadError: 'Không thể tải dữ liệu trung tâm điều phối nhóm. Hãy làm mới và thử lại.',
      metrics: {
        onJob: 'Đang làm việc',
        dueToday: 'Hôm nay',
        needsAttention: 'Cần chú ý',
        availableTeam: 'Nhóm sẵn sàng'
      },
      overview: {
        title: 'Tổng quan nhóm',
        description: 'Mở một thành viên để xem lịch, phân công và liên hệ.',
        empty: 'Chưa có thành viên nhóm. Mời người hoặc phân công công việc để xem khối lượng tại đây.'
      },
      status: {
        needsAttention: 'Cần chú ý',
        onJob: 'Đang làm việc',
        scheduled: 'Đã lên lịch',
        overloaded: 'Quá tải',
        available: 'Sẵn sàng'
      },
      summary: {
        readyForAssignment: 'Sẵn sàng phân công',
        activeJobsOne: '{count} công việc đang hoạt động',
        activeJobsMany: '{count} công việc đang hoạt động',
        dueTodayCount: '{count} hôm nay',
        nextPrefix: 'Tiếp theo:',
        updatedPrefix: 'Cập nhật:',
        notUpdatedYet: 'Chưa cập nhật'
      },
      member: {
        defaultName: 'Thành viên nhóm',
        active: 'Đang hoạt động',
        dueToday: 'Hôm nay',
        overdue: 'Quá hạn',
        completed: 'Hoàn thành',
        nextAssignment: 'Phân công tiếp theo',
        noScheduledAssignment: 'Chưa có phân công theo lịch.',
        assignedDateNotScheduled: 'Đã phân công, chưa lên lịch ngày',
        contact: 'Liên hệ',
        noEmailOnFile: 'Chưa có email',
        viewSchedule: 'Xem lịch',
        viewJobs: 'Xem công việc',
        assignJob: 'Phân công công việc'
      }
    },
    role: {
      workspaceTitle: 'Công ty của bạn',
      workspaceTitleTeam: 'Trung tâm điều phối nhóm',
      workspaceIntro: 'Theo dõi công việc, lịch, ảnh, báo cáo và hoạt động nhóm.',
      workspaceIntroTeam: 'Góc nhìn chủ sở hữu và quản trị trong không gian này. Mỗi thẻ mở bản ghi đằng sau con số.',
      viewTeam: 'Xem nhóm',
      manageAccess: 'Quản lý quyền truy cập',
      teamOverview: 'Tổng quan nhóm',
      teamOverviewHint: 'Xem khối lượng của từng người mà không rời bảng điều khiển.',
      noTeamMembers: 'Không tìm thấy thành viên nhóm đang hoạt động.',
      lastActivity: 'Hoạt động gần nhất:',
      viewWorkload: 'Xem khối lượng',
      upcomingTeamJobs: 'Công việc nhóm sắp tới',
      upcomingJobs: 'Công việc sắp tới',
      openSchedule: 'Mở lịch',
      noUpcomingDueDates: 'Không có hạn sắp tới.',
      recentTeamActivity: 'Hoạt động nhóm gần đây',
      viewAuditTrail: 'Xem nhật ký',
      noRecentActivity: 'Chưa có hoạt động gần đây.',
      teamMember: 'Thành viên nhóm',
      quickOwnerActions: 'Thao tác nhanh cho chủ sở hữu',
      assignJob: 'Phân công công việc',
      quickActions: {
        messageTeam: 'Nhắn nhóm',
        reviewReports: 'Xem báo cáo',
        viewSchedule: 'Xem lịch'
      },
      metrics: {
        teamActiveJobs: 'Công việc nhóm đang hoạt động',
        activeJobs: 'Công việc đang hoạt động',
        teamCompletedJobs: 'Công việc nhóm đã hoàn thành',
        completed: 'Hoàn thành',
        teamOverdueJobs: 'Công việc nhóm quá hạn',
        overdue: 'Quá hạn',
        customers: 'Khách hàng',
        teamMembers: 'Thành viên nhóm',
        teamPhotos: 'Ảnh nhóm',
        teamReports: 'Báo cáo nhóm',
        teamActivity: 'Hoạt động nhóm',
        teamJobsThisMonth: 'Công việc nhóm tháng này',
        jobsThisMonth: 'Công việc tháng này',
        active: 'Đang hoạt động',
        dueToday: 'Hôm nay'
      },
      workload: {
        inactive: 'Không hoạt động',
        overloaded: 'Quá tải',
        busy: 'Bận',
        available: 'Sẵn sàng'
      },
      field: {
        title: 'Công việc hiện trường của tôi',
        intro: 'Góc nhìn đơn giản cho công việc được giao, ảnh, checklist và liên hệ khách hàng.',
        myActiveJobs: 'Công việc đang hoạt động',
        dueToday: 'Hôm nay',
        completed: 'Hoàn thành',
        photosUploaded: 'Ảnh đã tải lên',
        currentJob: 'Công việc hiện tại',
        currentJobHint: 'Mở công việc để bắt đầu, hoàn thành checklist, tải ảnh hoặc đánh dấu hoàn tất.',
        openJob: 'Mở công việc',
        noCustomerDetails: 'Chưa có thông tin khách hàng',
        startOrFinish: 'Bắt đầu hoặc hoàn thành',
        callCustomer: 'Gọi khách hàng',
        startNavigation: 'Bắt đầu dẫn đường',
        noAssignedWork: 'Chưa có công việc hiện trường',
        noAssignedWorkHint: 'Công việc được giao sẽ hiển thị tại đây với trạng thái, liên hệ, ảnh và checklist.',
        myJobsToday: 'Công việc hôm nay',
        viewAll: 'Xem tất cả',
        noJobsToday: 'Không có công việc hôm nay.',
        noLocation: 'Chưa có địa chỉ',
        nextAssignedJobs: 'Công việc được giao tiếp theo',
        noUpcomingAssigned: 'Không có công việc được giao sắp tới.',
        noActivityYet: 'Chưa có hoạt động',
        notScheduled: 'Chưa lên lịch'
      }
    }
  },
  billing: {
    title: 'Gói & thanh toán',
    description: 'Quản lý đăng ký, so sánh gói và nâng cấp khi bạn sẵn sàng.',
    pricingTitle: 'Gói và giá',
    pricingSubtitle: 'So sánh các gói cạnh nhau. Chọn gói trả phí phù hợp với không gian làm việc.',
    pricingPublicLead:
      'So sánh các gói cạnh nhau. Bắt đầu miễn phí hoặc nâng cấp khi bạn sẵn sàng — đăng ký gia hạn hàng tháng cho đến khi hủy.',
    pricingLoading: 'Đang tải gói…',
    planChangeIntro:
      'Đăng ký mới bắt đầu qua Stripe Checkout. Nâng cấp, hạ cấp và hủy dùng Quản lý thanh toán nếu bạn đã có đăng ký.',
    cancelViaPortal:
      'Hủy vẫn giữ quyền truy cập đến hết kỳ thanh toán hiện tại. Việc hủy là cuối cùng và không hoàn tiền.',
    upgradeDowngradeViaPortal:
      'Để nâng cấp hoặc hạ cấp đăng ký hiện có, mở Quản lý thanh toán và đổi gói trên Stripe.',
    openingPortal: 'Đang mở thanh toán…',
    pricingNav: {
      signIn: 'Đăng nhập',
      createAccount: 'Tạo tài khoản',
      dashboard: 'Bảng điều khiển',
      billing: 'Thanh toán',
      account: 'Tài khoản'
    },
    allPlans: 'Tất cả gói',
    currentPlan: 'Gói',
    currentPlanBadge: 'Gói hiện tại',
    status: 'Trạng thái',
    renewalDate: 'Ngày gia hạn',
    manageStripe: 'Quản lý thanh toán trên Stripe',
    manageBilling: 'Quản lý thanh toán',
    noCustomer: 'Chưa có khách hàng Stripe. Chọn gói trả phí bên dưới.',
    cancel: 'Hủy đăng ký',
    cancelPlan: 'Hủy gói',
    resume: 'Tiếp tục đăng ký',
    resumePlan: 'Tiếp tục gói',
    contactBillingSupport: 'Liên hệ hỗ trợ thanh toán',
    planChangesSupport: 'Thay đổi gói hiện được xử lý qua hỗ trợ thanh toán.',
    alreadySubscribedPortal:
      'Bạn đã có đăng ký đang hoạt động. Dùng Quản lý thanh toán để nâng cấp, hạ cấp hoặc hủy.',
    downgradeSupportNote: 'Chuyển sang gói miễn phí cần hỗ trợ thanh toán.',
    plansFootnote:
      'Đăng ký tự gia hạn cho đến khi bạn hủy. Mọi khoản thanh toán là cuối cùng và không hoàn tiền sau khi xử lý.',
    portalUnavailable: 'Cổng thanh toán chưa được cấu hình.',
    portalNotConfigured: 'Cổng thanh toán chưa được cấu hình.',
    upgradeOptions: 'Tùy chọn nâng cấp',
    upgrade: 'Nâng cấp',
    health: {
      title: 'Trạng thái thanh toán',
      description: 'Tổng quan nhanh về cách thanh toán công ty của bạn được kết nối và đồng bộ.',
      loading: 'Đang tải trạng thái thanh toán…',
      loadFailed: 'Không thể tải trạng thái thanh toán lúc này. Vui lòng thử lại sau.',
      currentPlan: 'Gói hiện tại',
      accountStatus: 'Trạng thái tài khoản',
      technicalDetails: 'Xem chi tiết kỹ thuật',
      status: {
        connected: 'Đã kết nối',
        needs_attention: 'Cần chú ý',
        action_required: 'Cần xử lý'
      },
      summary: {
        connected: 'Thanh toán của bạn đã được kết nối và đồng bộ đầy đủ.',
        needs_attention: 'Một số mục thanh toán cần chú ý. Xem trạng thái bên dưới.',
        action_required: 'Thanh toán cần được xử lý trước khi các tính năng trả phí hoạt động ổn định.'
      },
      cards: {
        stripeAccount: {
          connected: {
            title: 'Tài khoản Stripe đã kết nối',
            description: 'Công ty của bạn đã được liên kết với tài khoản khách hàng Stripe.'
          },
          needs_attention: {
            title: 'Tài khoản Stripe chưa được kết nối',
            description: 'Hoàn tất thanh toán hoặc đồng bộ billing để kết nối tài khoản Stripe.'
          },
          action_required: {
            title: 'Tài khoản Stripe chưa được kết nối',
            description: 'Hoàn tất thanh toán hoặc đồng bộ billing để kết nối tài khoản Stripe.'
          }
        },
        subscriptionInfo: {
          connected: {
            title: 'Thông tin đăng ký đã được cập nhật',
            description: 'Chi tiết gói và đăng ký của bạn đã có trong EverittOS.'
          },
          needs_attention: {
            title: 'Thông tin đăng ký vẫn đang đồng bộ',
            description: 'Chúng tôi đang hoàn tất liên kết giữa gói của bạn và Stripe. Thường sẽ xong sau thanh toán hoặc đồng bộ.'
          },
          action_required: {
            title: 'Thông tin đăng ký vẫn đang đồng bộ',
            description: 'Chúng tôi đang hoàn tất liên kết giữa gói của bạn và Stripe. Thường sẽ xong sau thanh toán hoặc đồng bộ.'
          }
        },
        billingConfiguration: {
          connected: {
            title: 'Cấu hình thanh toán đã sẵn sàng',
            description: 'Đường nâng cấp và giá gói đã khả dụng cho công ty này.'
          },
          needs_attention: {
            title: 'Cấu hình thanh toán cần được xem xét',
            description: 'Một số giá gói vẫn cần hoàn thiện. Liên hệ hỗ trợ nếu không thể nâng cấp.'
          },
          action_required: {
            title: 'Cấu hình thanh toán cần được xem xét',
            description: 'Một số giá gói vẫn cần hoàn thiện. Liên hệ hỗ trợ nếu không thể nâng cấp.'
          }
        },
        subscriptionSync: {
          connected: {
            title: 'Đồng bộ đăng ký đã hoàn tất',
            description: 'Các cập nhật đăng ký từ Stripe đã được nhận thành công.'
          },
          needs_attention: {
            title: 'Đồng bộ đăng ký chưa hoàn tất',
            description: 'Chúng tôi chưa ghi nhận đồng bộ Stripe hoàn tất cho tài khoản này. Hãy thử đồng bộ lại sau thanh toán.'
          },
          action_required: {
            title: 'Đồng bộ đăng ký cần được xử lý',
            description: 'Lần đồng bộ Stripe gần nhất không thành công. Hãy thử đồng bộ lại hoặc liên hệ hỗ trợ.'
          }
        },
        billingService: {
          connected: {
            title: 'Dịch vụ thanh toán đang hoạt động',
            description: 'EverittOS có thể giao tiếp với Stripe cho công ty này.'
          },
          needs_attention: {
            title: 'Dịch vụ thanh toán cần chú ý',
            description: 'Kết nối thanh toán hiện bị hạn chế. Hãy thử lại sau hoặc liên hệ hỗ trợ.'
          },
          action_required: {
            title: 'Dịch vụ thanh toán cần chú ý',
            description: 'Kết nối thanh toán hiện bị hạn chế. Hãy thử lại sau hoặc liên hệ hỗ trợ.'
          }
        }
      },
      technical: {
        profilePlan: 'Gói trên hồ sơ (raw)',
        subscriptionStatus: 'Trạng thái đăng ký (raw)',
        stripeCustomerId: 'Stripe customer ID',
        stripeSubscriptionId: 'Stripe subscription ID',
        stripePriceId: 'Stripe price ID',
        latestWebhook: 'Đồng bộ webhook gần nhất',
        notSet: 'Chưa có',
        noWebhookYet: 'Chưa có đồng bộ webhook',
        webhookSuccess: 'Đã đồng bộ từ {event}',
        webhookFailed: 'Đồng bộ thất bại: {reason}',
        unknown: 'không rõ',
        stripeConfigured: 'Stripe API đã cấu hình',
        webhookConfigured: 'Stripe webhook đã cấu hình',
        checkoutConfigured: 'Giá checkout đã cấu hình',
        yes: 'Có',
        no: 'Không',
        noIssues: 'Không có mã chẩn đoán nội bộ.'
      }
    },
    promo: {
      label: 'Mã khuyến mãi',
      applyBeforeCheckout: 'Áp dụng mã khuyến mãi trước khi chọn gói trả phí.',
      previewFor: 'Xem trước cho',
      placeholder: 'Nhập mã khuyến mãi',
      apply: 'Áp dụng',
      validating: 'Đang xác minh…',
      invalid: 'Mã khuyến mãi này không hợp lệ.',
      applied: 'Đã áp dụng mã: {code}',
      savings: 'Tiết kiệm {amount} mỗi tháng',
      expires: 'Mã hết hạn {date}',
      expiresLabel: 'Hết hạn',
      activeTitle: 'Giảm giá đang áp dụng',
      couponName: 'Phiếu giảm giá',
      code: 'Mã khuyến mãi',
      discount: 'Giảm giá',
      checkoutNote: 'Stripe xác minh giảm giá trước khi thanh toán. Giá cập nhật sau khi áp mã.',
      checkoutSuccess: 'Thanh toán hoàn tất. Đăng ký sẽ cập nhật trong giây lát.',
      checkoutActivated: 'Thanh toán thành công — gói của bạn đã được kích hoạt.',
      checkoutSyncing:
        'Đã nhận thanh toán, nhưng kích hoạt gói vẫn đang đồng bộ. Hãy làm mới hoặc liên hệ hỗ trợ nếu không cập nhật.',
      checkoutInactive: 'Thanh toán thất bại hoặc đăng ký không hoạt động.',
      checkoutCancelled: 'Thanh toán đã hủy. Không có khoản phí nào.',
      checkoutFailed: 'Không thể bắt đầu thanh toán. Thử lại hoặc liên hệ hỗ trợ.',
      startingCheckout: 'Đang bắt đầu thanh toán…',
      applyFirst: 'Áp dụng mã khuyến mãi hợp lệ trước khi thanh toán.',
      signInNote: 'Đã có tài khoản?'
    },
    noRefund: {
      policyShort: 'Mọi khoản thanh toán là cuối cùng. Không hoàn tiền sau khi xử lý.',
      policyFull:
        'Mọi khoản thanh toán là cuối cùng. EverittOS không hoàn tiền cho đăng ký, phí thiết lập, dịch vụ số, sử dụng AI, quyền truy cập công ty, tiện ích bổ sung hoặc kỳ thanh toán đã sử dụng một phần. Bạn có thể hủy bất cứ lúc nào để dừng gia hạn trong tương lai, nhưng các khoản đã thu trước đó không được hoàn lại.',
      checkoutAck: 'Tôi hiểu mọi khoản thanh toán là cuối cùng và không hoàn tiền.',
      ackRequired: 'Xác nhận chính sách không hoàn tiền trước khi thanh toán.',
      cancelNote: 'Hủy chỉ dừng gia hạn trong tương lai. Các khoản đã thu trước đó không được hoàn lại.'
    },
    aiAccess: {
      title: 'Quyền truy cập AI',
      askEverittIncluded: 'Tìm kiếm Ask Everitt được bao gồm trong mọi gói.',
      everittAiPlans: 'Everitt AI có sẵn trên gói Business và Enterprise.',
      includedOnPlan: 'Everitt AI được bao gồm trong gói {plan} của bạn.',
      upgradeCta: 'Nâng cấp để mở khóa Everitt AI',
      viewUsageLink: 'Xem chi tiết sử dụng AI và số liệu nhân viên'
    }
  },
  aiUsage: {
    title: 'Sử dụng AI',
    description: 'Số lượng prompt, chi phí ước tính, theo dõi hạn mức và số liệu sử dụng nhân viên dành cho quản trị viên.',
    adminOnly: 'Chỉ chủ sở hữu và quản trị viên công ty mới có thể xem số liệu sử dụng AI.'
  },
  language: {
    title: 'Ngôn ngữ',
    note: 'Ngôn ngữ thay đổi nhãn chính của ứng dụng. Một số văn bản pháp lý và thanh toán có thể vẫn bằng tiếng Anh.'
  },
  feedback: {
    saved: 'Đã lưu',
    updated: 'Đã cập nhật',
    created: 'Đã tạo',
    deleted: 'Đã xóa',
    sent: 'Đã gửi',
    submitted: 'Đã gửi',
    connected: 'Đã kết nối',
    disconnected: 'Đã ngắt kết nối',
    uploadComplete: 'Tải lên hoàn tất',
    syncComplete: 'Đồng bộ hoàn tất',
    copied: 'Đã sao chép',
    removed: 'Đã xóa',
    invited: 'Đã gửi lời mời',
    paymentRecorded: 'Đã ghi nhận thanh toán',
    loading: 'Đang xử lý…',
    genericError: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    requestFailed: 'Yêu cầu thất bại.'
  },
  pages: {
    invoices: {
      title: 'Hóa đơn',
      subtitle: 'Gửi hóa đơn cho khách hàng trong một bước. Số tiền và tin nhắn tự động lưu khi soạn.',
      loading: 'Đang tải hóa đơn…'
    },
    messages: {
      title: 'Tin nhắn',
      subtitle: 'Nhắn tin khách hàng qua email. Luồng hội thoại lưu lịch sử gửi và lỗi giao hàng.'
    },
    inventory: {
      title: 'Kho hàng',
      subtitle: 'Theo dõi vật tư và thiết bị. Điều chỉnh cập nhật số lượng và giữ nhật ký kiểm tra.',
      noAccess: 'Bạn không có quyền truy cập kho hàng.',
      schemaNotReady: 'Bảng kho hàng chưa được thiết lập. Chạy migration Supabase mới nhất rồi tải lại.',
      addItem: 'Thêm mục',
      close: 'Đóng',
      name: 'Tên',
      category: 'Danh mục',
      quantity: 'Số lượng',
      unit: 'Đơn vị',
      reorderLevel: 'Mức đặt lại',
      saveItem: 'Lưu mục',
      saving: 'Đang lưu…',
      loading: 'Đang tải kho hàng…',
      empty: 'Chưa có mục kho hàng.',
      colItem: 'Mục',
      colQty: 'SL',
      colReorder: 'Đặt lại',
      colLocation: 'Vị trí',
      lowStock: 'Sắp hết',
      adjust: 'Điều chỉnh',
      adjustPlaceholder: '+/-',
      loadError: 'Không thể tải kho hàng.',
      createError: 'Không thể tạo mục.',
      adjustError: 'Không thể điều chỉnh số lượng.'
    },
    routes: {
      title: 'Lập tuyến đường',
      subtitle: 'Sắp xếp công việc theo địa chỉ và lịch cơ bản. Không phải tối ưu thời gian lái xe.',
      buildRoute: 'Tạo tuyến',
      building: 'Đang tạo…',
      loading: 'Đang tải tuyến…',
      empty: 'Chưa có tuyến nào.',
      colDate: 'Ngày',
      colStatus: 'Trạng thái',
      colStops: 'Điểm dừng',
      view: 'Xem',
      apply: 'Áp dụng',
      stopsFor: 'Điểm dừng ngày {date}',
      missingAddress: 'Thiếu địa chỉ',
      addressNeeded: 'cần địa chỉ',
      applyConfirm: 'Áp dụng thứ tự tuyến này cho các công việc đã lên lịch?',
      optimizeError: 'Không thể tạo tuyến.',
      applyError: 'Không thể áp dụng tuyến.'
    },
    recurring: {
      title: 'Hóa đơn định kỳ',
      subtitle: 'Tạo hóa đơn nháp theo lịch. Không tự động thu phí hoặc gửi.',
      schemaNotReady: 'Bảng hóa đơn định kỳ chưa được thiết lập. Chạy migration và tải lại.',
      addTemplate: 'Thêm mẫu',
      close: 'Đóng',
      titleField: 'Tiêu đề',
      amount: 'Số tiền',
      nextRun: 'Lần chạy tiếp',
      saveTemplate: 'Lưu mẫu',
      saving: 'Đang lưu…',
      loading: 'Đang tải mẫu định kỳ…',
      empty: 'Chưa có mẫu hóa đơn định kỳ.',
      colTitle: 'Tiêu đề',
      colAmount: 'Số tiền',
      colCadence: 'Chu kỳ',
      colNextRun: 'Lần chạy tiếp',
      colStatus: 'Trạng thái',
      notSet: 'Chưa đặt',
      active: 'Đang hoạt động',
      paused: 'Tạm dừng',
      runNow: 'Chạy ngay',
      running: 'Đang chạy…',
      pause: 'Tạm dừng',
      resume: 'Tiếp tục',
      recentRuns: 'Lần chạy gần đây',
      invoiceCreated: 'Đã tạo hóa đơn',
      loadError: 'Không thể tải hóa đơn định kỳ.',
      createError: 'Không thể tạo mẫu.',
      updateError: 'Không thể cập nhật mẫu.',
      runError: 'Không thể chạy mẫu.',
      draftCreated: 'Đã tạo hóa đơn nháp. Kiểm tra tab Nháp phía trên.',
      cadence: { weekly: 'Hàng tuần', monthly: 'Hàng tháng', quarterly: 'Hàng quý', yearly: 'Hàng năm' }
    },
    customerMessages: {
      schemaNotReady: 'Bảng tin nhắn khách hàng chưa được thiết lập. Chạy migration và tải lại.',
      composeTitle: 'Soạn tin nhắn',
      recipientEmail: 'Email người nhận',
      subject: 'Chủ đề',
      message: 'Tin nhắn',
      sendEmail: 'Gửi email',
      sending: 'Đang gửi…',
      threads: 'Luồng hội thoại',
      loadingThreads: 'Đang tải luồng…',
      emptyThreads: 'Chưa có luồng tin nhắn.',
      colSubject: 'Chủ đề',
      colStatus: 'Trạng thái',
      colLastMessage: 'Tin nhắn cuối',
      open: 'Mở',
      noSubject: 'Không có chủ đề',
      thread: 'Luồng',
      reply: 'Trả lời',
      sendReply: 'Gửi trả lời',
      loadError: 'Không thể tải tin nhắn.',
      threadLoadError: 'Không thể tải luồng.',
      sendError: 'Không thể gửi tin nhắn.',
      replyError: 'Không thể gửi trả lời.',
      emailFailed: 'Email thất bại. Tin nhắn được lưu với trạng thái thất bại.'
    },
    quickbooks: {
      loading: 'Đang tải trạng thái QuickBooks…',
      loadError: 'Không thể tải trạng thái QuickBooks.',
      statusLabel: 'Trạng thái',
      connected: 'Đã kết nối',
      notConnected: 'Chưa kết nối',
      notConfigured: 'Máy chủ chưa cấu hình',
      needsReconnect: 'Cần kết nối lại',
      company: 'Công ty',
      companyId: 'Mã công ty QuickBooks',
      lastSync: 'Đồng bộ thành công lần cuối',
      lastError: 'Lỗi gần nhất',
      connect: 'Kết nối QuickBooks',
      reconnect: 'Kết nối lại QuickBooks',
      disconnect: 'Ngắt kết nối QuickBooks',
      recentSyncLog: 'Nhật ký đồng bộ gần đây',
      noSyncAttempts: 'Chưa có lần đồng bộ nào.',
      connectFailed: 'Kết nối QuickBooks thất bại ({reason}).'
    },
    calendarImport: {
      title: 'Nhập lịch',
      description: 'Tự động tạo công việc từ lịch bên ngoài.',
      urlPlaceholder: 'URL đăng ký lịch',
      helper: 'Dán liên kết đăng ký lịch iCal hoặc ICS riêng tư.',
      connect: 'Kết nối và nhập',
      connected: 'Đã kết nối',
      lastSync: 'Lần đồng bộ cuối',
      neverSynced: 'Chưa đồng bộ',
      syncNow: 'Đồng bộ ngay',
      disconnect: 'Ngắt kết nối',
      connecting: 'Đang kết nối…',
      syncing: 'Đang đồng bộ…',
      disconnecting: 'Đang ngắt kết nối…',
      loadError: 'Không thể tải trạng thái nhập lịch.',
      connectError: 'Không thể kết nối lịch.',
      syncError: 'Không thể đồng bộ lịch.',
      disconnectError: 'Không thể ngắt kết nối lịch.',
      syncResult: 'Đã thêm {created} công việc, {updated} đã cập nhật, {skipped} đã tồn tại.',
      syncResultFailedOne: 'Không thể nhập {failed} sự kiện.',
      syncResultFailedMany: 'Không thể nhập {failed} sự kiện.',
      syncResultFailedOneWithReason: 'Không thể nhập {failed} sự kiện: {reason}.',
      syncResultFailedManyWithReason: 'Không thể nhập {failed} sự kiện: {reason}.',
      failureReason: {
        schema_mismatch: 'các trường công việc không khớp với schema cơ sở dữ liệu hiện tại',
        invalid_timezone: 'múi giờ không hợp lệ',
        invalid_event_time: 'không đọc được thời gian bắt đầu',
        job_insert_failed: 'không thể lưu sự kiện thành công việc',
        job_update_failed: 'không thể cập nhật công việc hiện có',
        missing_event_uid: 'sự kiện thiếu định danh ổn định',
        duplicate_conflict: 'sự kiện trùng với công việc hiện có',
        unsupported_all_day: 'không thể nhập sự kiện cả ngày'
      },
      lastError: {
        schema_mismatch: 'Các trường công việc lịch không khớp với schema cơ sở dữ liệu hiện tại.',
        invalid_timezone: 'Cơ sở dữ liệu đã từ chối múi giờ của công việc.',
        invalid_event_time: 'Không thể nhập sự kiện lịch vì không đọc được thời gian bắt đầu.',
        job_insert_failed: 'Không thể lưu các sự kiện lịch thành công việc.',
        job_update_failed: 'Không thể cập nhật các công việc đã nhập vì ràng buộc cơ sở dữ liệu.',
        missing_event_uid: 'Không thể nhập sự kiện lịch vì chúng thiếu định danh ổn định.',
        duplicate_conflict: 'Các sự kiện lịch trùng với công việc hiện có và được giữ nguyên.',
        unsupported_all_day: 'Không thể nhập các sự kiện cả ngày.'
      }
    },
    duplicateCleanup: {
      title: 'Dọn công việc trùng',
      back: 'Quay lại công việc',
      checking: 'Đang kiểm tra công việc định kỳ…',
      none: 'Không tìm thấy chuỗi công việc định kỳ bị trùng.',
      found: 'Tìm thấy {count} chuỗi công việc định kỳ bị trùng',
      remove: 'Xóa bản trùng',
      removing: 'Đang xóa…',
      confirm:
        'Thao tác này sẽ xóa chuỗi định kỳ bị trùng và các lần hẹn tương lai, đồng thời giữ lại chuỗi gốc. Các công việc lịch sử đã hoàn thành không bị thay đổi. Tiếp tục?',
      failed: 'Không thể kiểm tra công việc bị trùng.',
      done: 'Đã xóa các công việc định kỳ bị trùng.',
      noAddress: 'Không có địa chỉ',
      findDuplicates: 'Tìm bản trùng'
    },
    customers: { notFound: 'Không tìm thấy khách hàng' },
    jobs: {
      notFound: 'Không tìm thấy công việc',
      needsAssignment: 'Cần phân công',
      showAll: 'Xem tất cả công việc',
      assignedEmail: 'Email được phân công',
      assignedEmailHint: 'Tùy chọn. Ai sẽ nhận công việc này. Không cần hồ sơ trong Nhóm.',
      createTitle: 'Tạo công việc',
      createPermissionBlocked: 'Bạn không có quyền tạo công việc trên tài khoản này.',
      restoreJob: 'Khôi phục công việc',
      cancelJob: 'Hủy công việc',
      missingCompletionDate: 'Thiếu ngày hoàn thành'
    }
  },
  portal: portalMessagesVi
};
