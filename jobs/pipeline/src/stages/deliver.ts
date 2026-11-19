/**
 * The deliver stage. The email itself is built in @reportpilot/report so
 * the dashboard's "Send now" produces exactly the same message, and the
 * Resend client lives with the other integrations.
 */
export { composeEmail, type Email, type EmailSite } from "@reportpilot/report/email";
export { resendSender, type Sender } from "@reportpilot/integrations";
