/**
 * Platform support contact shown to signed-in coordinators and members.
 * Set by the admin (Settings → Contact info); either field may be null/hidden.
 * Mirrors the backend GET /support-contact response.
 */
export interface SupportContact {
  supportWhatsapp: string | null;
  supportEmail: string | null;
}
