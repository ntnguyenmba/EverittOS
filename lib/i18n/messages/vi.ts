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
    createSampleJob: 'Tạo công việc mẫu',
    optional: 'Tùy chọn',
    language: 'Ngôn ngữ'
  },
  onboarding: {
    progress: 'Bước {current} / {total}',
    skipEntire: 'Bỏ qua thiết lập',
    loading: 'Đang tải không gian làm việc…',
    calendarLater: 'Có thể kết nối lịch sau.',
    inviteFailed: 'Không gửi được lời mời. Bạn có thể mời nhóm sau trong Cài đặt.',
    sampleJobName: 'Chuyến thăm chào mừng',
    sampleCustomer: 'Khách hàng mẫu',
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
        subtitle: 'Thêm công việc thật, tạo mẫu, hoặc bỏ qua và bắt đầu từ bảng điều khiển.',
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
      maintenance: 'Bảo trì',
      construction: 'Xây dựng',
      landscaping: 'Cảnh quan',
      field_service: 'Dịch vụ hiện trường',
      hospitality: 'Khách sạn & nhà hàng',
      other: 'Khác'
    },
    teamSizes: {
      solo: 'Chỉ tôi',
      small: '2–5',
      medium: '6–20',
      large: '21–50',
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
        'Thiết lập tùy chọn giúp bạn khởi động nhanh hơn. Bỏ qua bất cứ lúc nào — không chặn công việc của bạn.',
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
      title: 'Mời thành viên nhóm đầu tiên',
      description: 'Phân công công việc và giữ mọi người đồng bộ từ hiện trường hoặc văn phòng.',
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
  }
};
