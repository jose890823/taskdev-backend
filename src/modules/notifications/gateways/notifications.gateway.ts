import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { Notification } from '../entities/notification.entity';

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  /** Mapa userId -> Set de socketIds conectados */
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Al conectar: verificar JWT, unir a room personal
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace('Bearer ', '') as string);

      if (!token) {
        this.logger.warn(`Socket ${client.id}: sin token`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = jwt.verify(token, secret!) as { sub: string };
      const userId = payload.sub;

      if (!userId) {
        client.disconnect();
        return;
      }

      // Guardar userId en el socket
      (client as any).userId = userId;

      // Unir a room personal
      await client.join(`user:${userId}`);

      // Trackear conexion
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      this.logger.log(`Socket conectado: ${client.id} (user: ${userId})`);
    } catch (err) {
      this.logger.warn(`Socket ${client.id}: token invalido`);
      client.disconnect();
    }
  }

  /**
   * Al desconectar: limpiar tracking
   */
  handleDisconnect(client: Socket): void {
    const userId = (client as any).userId as string | undefined;
    if (userId) {
      const sockets = this.connectedUsers.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      }
    }
    this.logger.debug(`Socket desconectado: ${client.id}`);
  }

  /**
   * Enviar notificacion a un usuario especifico
   */
  sendToUser(userId: string, notification: Notification): void {
    this.server.to(`user:${userId}`).emit('new-notification', notification);
  }

  /**
   * Enviar conteo de no leidas a un usuario
   */
  sendUnreadCount(userId: string, count: number): void {
    this.server.to(`user:${userId}`).emit('unread-count', { count });
  }
}
