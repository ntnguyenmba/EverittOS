import { isAccountActive, isAccountDeleted } from '@/lib/account-status';
import { logAuthEvent } from '@/lib/auth-logger';
import { mapAuthError } from '@/lib/auth-errors';
import { isValidEmail, normalizeEmail, validatePasswordLength } from '@/lib/input-validation';
import { postAuthRedirectPath } from '@/lib/post-auth-redirect';
import { ensureUserWorkspace, isRetryableBootstrapCode } from '@/lib/profile-bootstrap-server';
import { sanitize