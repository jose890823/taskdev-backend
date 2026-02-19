interface InvitationTemplateData {
  organizationName: string;
  inviteUrl: string;
  invitedByName?: string;
  role: string;
  brandName?: string;
  projectName?: string;
}

export function getInvitationEmailTemplate(data: InvitationTemplateData): string {
  const brandName = data.brandName || 'TaskHub';
  const invitedBy = data.invitedByName ? ` por <strong>${data.invitedByName}</strong>` : '';

  const roleLabels: Record<string, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    member: 'Miembro',
    viewer: 'Observador',
  };
  const roleLabel = roleLabels[data.role] || data.role;

  const inviteTarget = data.projectName
    ? `al proyecto <strong>${data.projectName}</strong> en la organizacion <strong>${data.organizationName}</strong>`
    : `a la organizacion <strong>${data.organizationName}</strong>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitacion</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Te han invitado a unirte
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                ${brandName}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Has sido invitado${invitedBy} a unirte ${inviteTarget} como <strong>${roleLabel}</strong>.
              </p>

              <p style="margin: 0 0 30px; color: #555555; font-size: 15px; line-height: 1.6;">
                Haz clic en el boton de abajo para aceptar la invitacion. Si no tienes cuenta,
                podras registrarte primero.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Aceptar Invitacion
                </a>
              </div>

              <p style="margin: 0 0 10px; color: #888888; font-size: 13px; line-height: 1.5;">
                Si el boton no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin: 0 0 20px; color: #667eea; font-size: 13px; word-break: break-all;">
                ${data.inviteUrl}
              </p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #666666; font-size: 13px; line-height: 1.5;">
                  Esta invitacion expira en <strong>7 dias</strong>. Si no solicitaste esta invitacion,
                  puedes ignorar este correo.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center;">
              <p style="margin: 0 0 10px; color: #6c757d; font-size: 14px;">
                <strong>${brandName}</strong>
              </p>
              <p style="margin: 0; color: #adb5bd; font-size: 12px;">
                Gestion de tareas y proyectos
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
