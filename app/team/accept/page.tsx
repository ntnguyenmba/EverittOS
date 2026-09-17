'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useTranslation } from '@/components/locale-provider';
import { CLIENT_PORTAL_HOME, CONTRACTOR_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type AcceptStatus = 'checking' | 'needs-sign-in' | 'accepted' | 'already-accepted' | 'error';

const copy = {
  en: {
    continue: 'Continue', openSharedJob: 'Open shared job', openContractorPortal: 'Open contractor portal',
    allSet: 'All set', signInRequired: 'Sign in required', actionNeeded: 'Action needed', checking: 'Checking',
    checkingInvite: 'Checking your invitation…', signInStep: 'Next step: sign in with the same email address that received the invite, then return here to open your shared access.',
    acceptError: 'Could not accept invitation. Ask the workspace owner to resend the invite.',
    clientAlready: 'You already have access. Opening your shared job…', clientAccepted: 'Invitation accepted. Opening your shared job…',
    contractorAlready: 'You already have contractor access. Opening your portal…', contractorAccepted: 'Invitation accepted. Opening your contractor portal…',
    teamAlready: 'You are already connected to this workspace. No further action is needed.', teamAccepted: 'Invitation accepted. You are now connected to the workspace.',
    sharedAccess: 'EverittOS shared access', teamAccess: 'EverittOS team access', acceptShared: 'Accept shared job invitation',
    acceptContractor: 'Accept contractor invitation', acceptTeam: 'Accept team invitation',
    clientHelp: 'This page connects your signed-in account so you can view the shared job. Use the same email address that received the invitation.',
    teamHelp: 'This page connects your signed-in account to the business workspace. Use the same email address that received the invitation.',
    accept: 'Accept invitation', signInInvited: 'Sign in with invited email', loading: 'Loading…'
  },
  es: {
    continue: 'Continuar', openSharedJob: 'Abrir trabajo compartido', openContractorPortal: 'Abrir portal de contratista',
    allSet: 'Todo listo', signInRequired: 'Inicio de sesión requerido', actionNeeded: 'Acción necesaria', checking: 'Verificando',
    checkingInvite: 'Verificando su invitación…', signInStep: 'Siguiente paso: inicie sesión con el mismo correo que recibió la invitación y vuelva aquí para abrir el acceso compartido.',
    acceptError: 'No se pudo aceptar la invitación. Pida al propietario que la envíe de nuevo.',
    clientAlready: 'Ya tiene acceso. Abriendo el trabajo compartido…', clientAccepted: 'Invitación aceptada. Abriendo el trabajo compartido…',
    contractorAlready: 'Ya tiene acceso de contratista. Abriendo su portal…', contractorAccepted: 'Invitación aceptada. Abriendo el portal de contratista…',
    teamAlready: 'Ya está conectado a este espacio de trabajo. No necesita hacer nada más.', teamAccepted: 'Invitación aceptada. Ahora está conectado al espacio de trabajo.',
    sharedAccess: 'Acceso compartido de EverittOS', teamAccess: 'Acceso al equipo de EverittOS', acceptShared: 'Aceptar invitación al trabajo compartido',
    acceptContractor: 'Aceptar invitación de contratista', acceptTeam: 'Aceptar invitación al equipo',
    clientHelp: 'Esta página conecta su cuenta para ver el trabajo compartido. Use el mismo correo que recibió la invitación.',
    teamHelp: 'Esta página conecta su cuenta al espacio de trabajo. Use el mismo correo que recibió la invitación.',
    accept: 'Aceptar invitación', signInInvited: 'Iniciar sesión con el correo invitado', loading: 'Cargando…'
  },
  vi: {
    continue: 'Tiếp tục', openSharedJob: 'Mở công việc được chia sẻ', openContractorPortal: 'Mở cổng nhà thầu',
    allSet: 'Đã sẵn sàng', signInRequired: 'Cần đăng nhập', actionNeeded: 'Cần hành động', checking: 'Đang kiểm tra',
    checkingInvite: 'Đang kiểm tra lời mời…', signInStep: 'Bước tiếp theo: đăng nhập bằng đúng email đã nhận lời mời, rồi quay lại đây để mở quyền truy cập được chia sẻ.',
    acceptError: 'Không thể chấp nhận lời mời. Hãy yêu cầu chủ không gian làm việc gửi lại lời mời.',
    clientAlready: 'Bạn đã có quyền truy cập. Đang mở công việc được chia sẻ…', clientAccepted: 'Đã chấp nhận lời mời. Đang mở công việc được chia sẻ…',
    contractorAlready: 'Bạn đã có quyền nhà thầu. Đang mở cổng của bạn…', contractorAccepted: 'Đã chấp nhận lời mời. Đang mở cổng nhà thầu…',
    teamAlready: 'Bạn đã kết nối với không gian làm việc này. Không cần làm gì thêm.', teamAccepted: 'Đã chấp nhận lời mời. Bạn hiện đã kết nối với không gian làm việc.',
    sharedAccess: 'Quyền truy cập chia sẻ EverittOS', teamAccess: 'Quyền truy cập nhóm EverittOS', acceptShared: 'Chấp nhận lời mời công việc được chia sẻ',
    acceptContractor: 'Chấp nhận lời mời nhà thầu', acceptTeam: 'Chấp nhận lời mời nhóm',
    clientHelp: 'Trang này kết nối tài khoản đã đăng nhập để bạn xem công việc được chia sẻ. Hãy dùng đúng email đã nhận lời mời.',
    teamHelp: 'Trang này kết nối tài khoản đã đăng nhập với không gian làm việc. Hãy dùng đúng email đã nhận lời mời.',
    accept: 'Chấp nhận lời mời', signInInvited: 'Đăng nhập bằng email được mời', loading: 'Đang tải…'
  }
} as const;

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useTranslation();
  const c = copy[locale];
  const token = params.get('token') || '';
  const [message, setMessage] = useState(c.checkingInvite);
  const [status, setStatus] = useState<AcceptStatus>('checking');
  const [loading, setLoading] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<ReturnType<typeof normalizeRole> | null>(null);
  const signInHref = token ? `/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}` : '/login';

  const accept = useCallback(async () => {
    setLoading(true);
    setStatus('checking');
    setMessage(c.checkingInvite);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setStatus('needs-sign-in');
      setMessage(c.signInStep);
      return;
    }

    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setStatus('error');
      setMessage(json.error || c.acceptError);
      return;
    }

    const role = normalizeRole(json.role);
    const destination =
      typeof json.redirectTo === 'string' && json.redirectTo.startsWith('/')
        ? json.redirectTo
        : isClientRole(role)
          ? CLIENT_PORTAL_HOME
          : isContractorRole(role)
            ? CONTRACTOR_PORTAL_HOME
            : '/dashboard';

    setInviteRole(role);
    setRedirectTo(destination);

    const alreadyAccepted = json.alreadyAccepted === true;
    setStatus(alreadyAccepted ? 'already-accepted' : 'accepted');

    if (isClientRole(role)) {
      setMessage(
        alreadyAccepted
          ? c.clientAlready
          : c.clientAccepted
      );
      router.replace(destination);
      return;
    }

    if (isContractorRole(role)) {
      setMessage(
        alreadyAccepted
          ? c.contractorAlready
          : c.contractorAccepted
      );
      router.replace(destination);
      return;
    }

    setMessage(
      alreadyAccepted
        ? c.teamAlready
        : c.teamAccepted
    );
  }, [c, router, token]);

  useEffect(() => {
    void accept();
  }, [accept]);

  const isClientInvite = inviteRole != null && isClientRole(inviteRole);
  const isContractorInvite = inviteRole != null && isContractorRole(inviteRole);
  const isPortalInvite = isClientInvite || isContractorInvite;
  const ctaLabel = isClientInvite ? c.openSharedJob : isContractorInvite ? c.openContractorPortal : c.continue;

  return (
    <AuthenticatedSection>
      <div className="card form">
        <p className="eyebrow">{isPortalInvite ? c.sharedAccess : c.teamAccess}</p>
        <h2>
          {isClientInvite
            ? c.acceptShared
            : isContractorInvite
              ? c.acceptContractor
              : c.acceptTeam}
        </h2>
        <p>
          {isClientInvite
            ? c.clientHelp
            : c.teamHelp}
        </p>
        <div className="auth-message" role="status">
          <strong>
            {status === 'accepted' || status === 'already-accepted'
              ? c.allSet
              : status === 'needs-sign-in'
                ? c.signInRequired
                : status === 'error'
                  ? c.actionNeeded
                  : c.checking}
          </strong>
          <p>{message}</p>
        </div>
        <div className="inline-actions">
          {status === 'accepted' || status === 'already-accepted' ? (
            <button type="button" className="btn btn-primary" onClick={() => router.push(redirectTo || '/dashboard')}>
              {ctaLabel}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void accept()}>
              {loading ? c.checking : c.accept}
            </button>
          )}
          {status === 'needs-sign-in' ? (
            <Link className="btn" href={signInHref}>
              {c.signInInvited}
            </Link>
          ) : null}
        </div>
      </div>
    </AuthenticatedSection>
  );
}

function InviteLoading() {
  const { locale } = useTranslation();
  return <div className="card">{copy[locale].loading}</div>;
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedSection>
          <InviteLoading />
        </AuthenticatedSection>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
