import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Admin edit of the platform support contact. Both optional; send an empty
 * string to clear a field. Kept as loose strings on purpose — a WhatsApp
 * number may carry a "+", spaces or brackets, and these are display-only
 * records (BookAm sends nothing through them). The service trims + nulls blanks.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportWhatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supportEmail?: string;
}
