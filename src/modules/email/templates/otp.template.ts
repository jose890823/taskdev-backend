interface OtpTemplateData {
  firstName: string;
  otpCode: string;
  expirationMinutes: number;
  brandName?: string;
}

export function getOtpEmailTemplate(data: OtpTemplateData): string {
  const brandName = data.brandName || 'MiChambita';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de verificación</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Código de verificación
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.5;">
                Hola <strong>${data.firstName}</strong>,
              </p>

              <p style="margin: 0 0 30px; color: #555555; font-size: 15px; line-height: 1.6;">
                Gracias por registrarte en <strong>${brandName}</strong>. Para completar tu registro, usa el siguiente código:
              </p>

              <!-- OTP Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center" style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
                    <div style="font-size: 42px; font-weight: 700; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${data.otpCode}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px; color: #555555; font-size: 15px; line-height: 1.6;">
                Este código es válido por <strong>${data.expirationMinutes} minutos</strong>.
              </p>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Importante:</strong> Si no solicitaste este código, ignora este mensaje.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px; color: #6c757d; font-size: 14px;">
                <strong>${brandName}</strong>
              </p>
              <p style="margin: 0; color: #adb5bd; font-size: 12px;">
                Tu copiloto de contenido
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
