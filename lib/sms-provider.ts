export type SmsProviderName = 'twilio' | 'not-configured';

export type SmsConfigurationStatus = {
  configured: boolean;
  provider: SmsProviderName;
  missing: string[];
  message: string;
};

export function smsConfigurationStatus(): SmsConfigurationStatus {
  const required = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const configured = missing.length === 0;

  return {
    configured,
    provider: configured ? 'twilio' : 'not-configured',
    missing,
    message: configured
      ? 'SMS is configured.'
      : `SMS is not configured. Add ${missing.join(', ')} in Vercel before enabling text message delivery.`
  };
}

export function transactionalSmsConfigured(): boolean {
  return smsConfigurationStatus().configured;
}
