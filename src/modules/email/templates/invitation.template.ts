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
  const invitedBy = data.invitedByName ? ` por <strong style="color: #e2e8f0;">${data.invitedByName}</strong>` : '';

  const roleLabels: Record<string, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    member: 'Miembro',
    viewer: 'Observador',
  };
  const roleLabel = roleLabels[data.role] || data.role;

  const inviteTarget = data.projectName
    ? `al proyecto <strong style="color: #e2e8f0;">${data.projectName}</strong> en <strong style="color: #e2e8f0;">${data.organizationName}</strong>`
    : `a la organizacion <strong style="color: #e2e8f0;">${data.organizationName}</strong>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitacion - ${brandName}</title>
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
                Tienes una invitacion
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 16px 40px 40px;">
              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.6;">
                Has sido invitado${invitedBy} a unirte ${inviteTarget} como <span style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 2px 10px; border-radius: 4px; font-size: 13px; font-weight: 500;">${roleLabel}</span>
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px;">
                <tr>
                  <td align="center">
                    <a href="${data.inviteUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 600;">
                      Aceptar invitacion
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Si no tienes cuenta en ${brandName}, podras registrarte al aceptar la invitacion.
              </p>

              <!-- Info box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="background-color: #0f172a; border-radius: 8px; padding: 16px;">
                    <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                      Esta invitacion expira en <span style="color: #94a3b8; font-weight: 500;">7 dias</span>. Si no la solicitaste, puedes ignorar este correo.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #475569; font-size: 12px; line-height: 1.5;">
                Si el boton no funciona, copia este enlace:<br>
                <a href="${data.inviteUrl}" style="color: #3b82f6; word-break: break-all; font-size: 12px;">${data.inviteUrl}</a>
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
