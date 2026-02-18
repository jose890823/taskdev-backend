interface PasswordResetTemplateData {
  firstName: string;
  resetUrl: string;
  brandName?: string;
}

export function getPasswordResetTemplate(
  data: PasswordResetTemplateData,
): string {
  const brandName = data.brandName || 'MiChambita';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Restablecer contraseña
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.5;">
                Hola <strong>${data.firstName}</strong>,
              </p>

              <p style="margin: 0 0 30px; color: #555555; font-size: 15px; line-height: 1.6;">
                Recibimos una solicitud para restablecer tu contraseña en <strong>${brandName}</strong>. Haz clic en el botón para crear una nueva:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 20px; color: #555555; font-size: 14px; line-height: 1.6;">
                Este enlace es válido por <strong>1 hora</strong>.
              </p>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Importante:</strong> Si no solicitaste este cambio, ignora este mensaje y tu contraseña seguirá igual.
                </p>
              </div>

              <p style="margin: 30px 0 0; color: #6c757d; font-size: 13px; line-height: 1.5;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${data.resetUrl}" style="color: #667eea; word-break: break-all;">${data.resetUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center;">
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
