interface WelcomeTemplateData {
  firstName: string;
  lastName?: string;
  brandName?: string;
}

export function getWelcomeEmailTemplate(data: WelcomeTemplateData): string {
  const brandName = data.brandName || 'TaskHub';
  const fullName = data.lastName
    ? `${data.firstName} ${data.lastName}`
    : data.firstName;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a ${brandName}</title>
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
              <h1 style="margin: 16px 0 0; color: #f1f5f9; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">
                Bienvenido a ${brandName}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 16px 40px 40px;">
              <p style="margin: 0 0 20px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                Hola <span style="color: #e2e8f0; font-weight: 500;">${fullName}</span>,
              </p>

              <p style="margin: 0 0 28px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                Tu cuenta ha sido verificada exitosamente. Ya puedes empezar a organizar tu trabajo con ${brandName}.
              </p>

              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px;">
                <tr>
                  <td style="background-color: #0f172a; border-radius: 12px; padding: 24px;">
                    <p style="margin: 0 0 16px; color: #e2e8f0; font-size: 14px; font-weight: 600;">
                      Que puedes hacer:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                          <span style="color: #3b82f6; margin-right: 8px;">&#10003;</span> Crear organizaciones y equipos
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                          <span style="color: #3b82f6; margin-right: 8px;">&#10003;</span> Gestionar proyectos con tableros Kanban
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                          <span style="color: #3b82f6; margin-right: 8px;">&#10003;</span> Asignar y dar seguimiento a tareas
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #94a3b8; font-size: 14px;">
                          <span style="color: #3b82f6; margin-right: 8px;">&#10003;</span> Planificar tu dia con tareas diarias
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Si tienes preguntas, no dudes en contactarnos.
              </p>
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
