interface OtpTemplateData {
  firstName: string;
  otpCode: string;
  expirationMinutes: number;
  brandName?: string;
}

export function getOtpEmailTemplate(data: OtpTemplateData): string {
  const brandName = data.brandName || 'TaskHub';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codigo de verificacion - ${brandName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background-color: #3b82f6; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; text-align: center; font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 16px;">
                T
              </div>
              <h1 style="margin: 16px 0 0; color: #f1f5f9; font-size: 22px; font-weight: 600; letter-spacing: -0.02em;">
                Codigo de verificacion
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 16px 40px 40px;">
              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                Hola <span style="color: #e2e8f0; font-weight: 500;">${data.firstName}</span>, usa el siguiente codigo para verificar tu cuenta en ${brandName}:
              </p>

              <!-- OTP Code -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background-color: #0f172a; border: 2px solid #3b82f6; border-radius: 12px; padding: 28px;">
                    <div style="font-size: 38px; font-weight: 700; color: #3b82f6; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                      ${data.otpCode}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Este codigo expira en <span style="color: #e2e8f0; font-weight: 500;">${data.expirationMinutes} minutos</span>.
              </p>

              <!-- Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: rgba(234, 179, 8, 0.1); border-left: 3px solid #eab308; padding: 12px 16px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #eab308; font-size: 13px; line-height: 1.5;">
                      Si no solicitaste este codigo, puedes ignorar este mensaje.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; color: #475569; font-size: 13px;">
                ${brandName} &mdash; Gestion de tareas y proyectos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
