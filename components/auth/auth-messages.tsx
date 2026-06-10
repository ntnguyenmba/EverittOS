type AuthMessagesProps = {
  error?: string | null;
  success?: string | null;
};

export function AuthMessages({ error, success }: AuthMessagesProps) {
  return (
    <>
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
      {success ? <p className="auth-message auth-message-success">{success}</p> : null}
    </>
  );
}
