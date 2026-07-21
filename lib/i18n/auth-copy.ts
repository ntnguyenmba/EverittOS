import { normalizeLocale, type Locale } from '@/lib/i18n/config';

export type AuthFlowCopy = {
  login: {
    title: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    signingIn: string;
    signIn: string;
    forgotPassword: string;
    createAccount: string;
  };
  signup: {
    title: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    confirmPassword: string;
    businessName: string;
    businessNameOptional: string;
    howDidYouHear: string;
    creating: string;
    createAccount: string;
    alreadyHaveAccount: string;
    signIn: string;
    emailPasswordRequired: string;
    passwordTooShort: string;
    passwordsDoNotMatch: string;
    tooManyAttempts: string;
  };
  forgot: {
    title: string;
    email: string;
    emailPlaceholder: string;
    sending: string;
    sendReset: string;
    backToSignIn: string;
    successFallback: string;
  };
  reset: {
    title: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    updating: string;
    updatePassword: string;
    requestNewLink: string;
    backToSignIn: string;
    passwordTooShortTitle: string;
    passwordTooShort: string;
    passwordsMismatchTitle: string;
    passwordsMismatch: string;
    successFallback: string;
  };
};

const en: AuthFlowCopy = {
  login: {
    title: 'Sign in',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'Your password',
    signingIn: 'Signing in...',
    signIn: 'Sign in',
    forgotPassword: 'Forgot password',
    createAccount: 'Create account'
  },
  signup: {
    title: 'Create account',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'Minimum 6 characters',
    confirmPassword: 'Confirm password',
    businessName: 'Business name',
    businessNameOptional: 'Optional',
    howDidYouHear: 'How did you hear about us?',
    creating: 'Creating account...',
    createAccount: 'Create account',
    alreadyHaveAccount: 'Already have an account?',
    signIn: 'Sign in',
    emailPasswordRequired: 'Email and password are required.',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordsDoNotMatch: 'Passwords do not match.',
    tooManyAttempts: 'Too many signup attempts. Wait an hour and try again.'
  },
  forgot: {
    title: 'Reset password',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    sending: 'Sending...',
    sendReset: 'Send reset email',
    backToSignIn: 'Back to sign in',
    successFallback:
      'If an account exists for that email, a reset link is on its way. Open the link to choose a new password.'
  },
  reset: {
    title: 'Choose a new password',
    newPassword: 'New password',
    newPasswordPlaceholder: 'Minimum 6 characters',
    confirmPassword: 'Confirm password',
    confirmPasswordPlaceholder: 'Repeat password',
    updating: 'Updating...',
    updatePassword: 'Update password',
    requestNewLink: 'Request new reset link',
    backToSignIn: 'Back to sign in',
    passwordTooShortTitle: 'Password too short',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordsMismatchTitle: 'Passwords do not match',
    passwordsMismatch: 'Enter the same password in both fields.',
    successFallback: 'Password updated. Redirecting to sign in...'
  }
};

const es: AuthFlowCopy = {
  login: {
    title: 'Iniciar sesión',
    email: 'Correo electrónico',
    emailPlaceholder: 'usted@empresa.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Su contraseña',
    signingIn: 'Iniciando sesión...',
    signIn: 'Iniciar sesión',
    forgotPassword: 'Olvidé mi contraseña',
    createAccount: 'Crear cuenta'
  },
  signup: {
    title: 'Crear cuenta',
    email: 'Correo electrónico',
    emailPlaceholder: 'usted@empresa.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Confirmar contraseña',
    businessName: 'Nombre del negocio',
    businessNameOptional: 'Opcional',
    howDidYouHear: '¿Cómo se enteró de nosotros?',
    creating: 'Creando cuenta...',
    createAccount: 'Crear cuenta',
    alreadyHaveAccount: '¿Ya tiene una cuenta?',
    signIn: 'Iniciar sesión',
    emailPasswordRequired: 'El correo y la contraseña son obligatorios.',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres.',
    passwordsDoNotMatch: 'Las contraseñas no coinciden.',
    tooManyAttempts: 'Demasiados intentos de registro. Espere una hora e intente de nuevo.'
  },
  forgot: {
    title: 'Restablecer contraseña',
    email: 'Correo electrónico',
    emailPlaceholder: 'usted@empresa.com',
    sending: 'Enviando...',
    sendReset: 'Enviar correo de restablecimiento',
    backToSignIn: 'Volver a iniciar sesión',
    successFallback:
      'Si existe una cuenta con ese correo, le enviaremos un enlace. Ábralo para elegir una nueva contraseña.'
  },
  reset: {
    title: 'Elija una nueva contraseña',
    newPassword: 'Nueva contraseña',
    newPasswordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Confirmar contraseña',
    confirmPasswordPlaceholder: 'Repita la contraseña',
    updating: 'Actualizando...',
    updatePassword: 'Actualizar contraseña',
    requestNewLink: 'Solicitar nuevo enlace',
    backToSignIn: 'Volver a iniciar sesión',
    passwordTooShortTitle: 'Contraseña demasiado corta',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres.',
    passwordsMismatchTitle: 'Las contraseñas no coinciden',
    passwordsMismatch: 'Escriba la misma contraseña en ambos campos.',
    successFallback: 'Contraseña actualizada. Redirigiendo al inicio de sesión...'
  }
};

const vi: AuthFlowCopy = {
  login: {
    title: 'Đăng nhập',
    email: 'Email',
    emailPlaceholder: 'ban@congty.com',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Mật khẩu của bạn',
    signingIn: 'Đang đăng nhập...',
    signIn: 'Đăng nhập',
    forgotPassword: 'Quên mật khẩu',
    createAccount: 'Tạo tài khoản'
  },
  signup: {
    title: 'Tạo tài khoản',
    email: 'Email',
    emailPlaceholder: 'ban@congty.com',
    password: 'Mật khẩu',
    passwordPlaceholder: 'Tối thiểu 6 ký tự',
    confirmPassword: 'Xác nhận mật khẩu',
    businessName: 'Tên doanh nghiệp',
    businessNameOptional: 'Không bắt buộc',
    howDidYouHear: 'Bạn biết đến chúng tôi từ đâu?',
    creating: 'Đang tạo tài khoản...',
    createAccount: 'Tạo tài khoản',
    alreadyHaveAccount: 'Đã có tài khoản?',
    signIn: 'Đăng nhập',
    emailPasswordRequired: 'Cần có email và mật khẩu.',
    passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự.',
    passwordsDoNotMatch: 'Mật khẩu không khớp.',
    tooManyAttempts: 'Quá nhiều lần đăng ký. Hãy đợi một giờ rồi thử lại.'
  },
  forgot: {
    title: 'Đặt lại mật khẩu',
    email: 'Email',
    emailPlaceholder: 'ban@congty.com',
    sending: 'Đang gửi...',
    sendReset: 'Gửi email đặt lại',
    backToSignIn: 'Quay lại đăng nhập',
    successFallback:
      'Nếu có tài khoản với email đó, chúng tôi sẽ gửi liên kết. Mở liên kết để chọn mật khẩu mới.'
  },
  reset: {
    title: 'Chọn mật khẩu mới',
    newPassword: 'Mật khẩu mới',
    newPasswordPlaceholder: 'Tối thiểu 6 ký tự',
    confirmPassword: 'Xác nhận mật khẩu',
    confirmPasswordPlaceholder: 'Nhập lại mật khẩu',
    updating: 'Đang cập nhật...',
    updatePassword: 'Cập nhật mật khẩu',
    requestNewLink: 'Yêu cầu liên kết mới',
    backToSignIn: 'Quay lại đăng nhập',
    passwordTooShortTitle: 'Mật khẩu quá ngắn',
    passwordTooShort: 'Mật khẩu phải có ít nhất 6 ký tự.',
    passwordsMismatchTitle: 'Mật khẩu không khớp',
    passwordsMismatch: 'Nhập cùng một mật khẩu ở cả hai ô.',
    successFallback: 'Đã cập nhật mật khẩu. Đang chuyển đến đăng nhập...'
  }
};

const byLocale: Record<Locale, AuthFlowCopy> = { en, es, vi };

export function getAuthFlowCopy(locale: string | null | undefined): AuthFlowCopy {
  return byLocale[normalizeLocale(locale)];
}
