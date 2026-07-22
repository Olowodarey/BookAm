import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends WhatsApp verification codes via Meta's WhatsApp Cloud API — free to
 * start (a test number can message up to 5 verified recipients at no cost),
 * cheap per-message at scale, and the natural channel for BookAm's users.
 *
 * Configure (see the setup notes in the README / CLAUDE.md):
 *   WHATSAPP_PHONE_NUMBER_ID   – the "Phone number ID" from WhatsApp API Setup
 *   WHATSAPP_ACCESS_TOKEN      – access token with whatsapp_business_messaging
 *   WHATSAPP_TEMPLATE_NAME     – an approved Authentication template (default below)
 *   WHATSAPP_TEMPLATE_LANG     – template language code (default en_US)
 *   WHATSAPP_API_VERSION       – Graph API version (default v21.0)
 *
 * With no credentials set, the code is logged instead of sent, so the whole
 * flow stays testable in dev without a Meta account.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private get config() {
    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      token: process.env.WHATSAPP_ACCESS_TOKEN,
      template: process.env.WHATSAPP_TEMPLATE_NAME ?? 'bookam_verification',
      lang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'en_US',
      version: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
    };
  }

  async sendCode(phone: string, code: string): Promise<void> {
    const { phoneNumberId, token, template, lang, version } = this.config;
    if (!phoneNumberId || !token) {
      // Dev fallback: no Cloud API configured, so surface the code in the logs.
      this.logger.log(`[whatsapp:dev] Verification code for ${phone}: ${code}`);
      return;
    }

    // Meta wants the recipient in international format, digits only (no '+').
    const to = phone.replace(/[^0-9]/g, '');

    // Authentication-category template: the code goes in the message body AND
    // the copy-code button, so WhatsApp can offer one-tap copy/autofill.
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.error(
          `WhatsApp send failed for ${to} (HTTP ${res.status}): ${detail}`,
        );
      }
    } catch (e) {
      this.logger.error(
        `WhatsApp send error for ${to}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
