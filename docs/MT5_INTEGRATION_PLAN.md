# Plan de Integración MT5 - Trading Bot

## 📋 CONTEXTO ACTUAL

### ✅ Lo que ya funciona:
1. Bot NestJS corriendo en puerto 3001
2. Claude AI analizando mercado y generando señales
3. Telegram enviando notificaciones correctamente
4. Endpoint `/ai-trading/test-production-flow/:symbol` funcionando
5. Sistema de trades con IDs únicos
6. Base de datos PostgreSQL configurada

### ❌ Problema Actual:
- **TwelveData tiene desfase de datos**: ~9 USD de diferencia en XAU/USD
  - TwelveData: 3824.40
  - Broker real: 3815.30
- **Necesitamos datos en tiempo real del broker**

---

## 🎯 OBJETIVO: Integrar MetaTrader 5

### Arquitectura Final (Todo en VPS):
```
VPS (Windows Server)
├── MetaTrader 5
│   └── Expert Advisor (Bridge MQL5)
│       └── Socket Server (localhost:8080)
├── Bot NestJS (Puerto 3001)
│   ├── MT5Service (conecta a localhost:8080)
│   ├── Claude AI
│   ├── Telegram Bot
│   └── PostgreSQL
└── Nginx (Reverse Proxy para frontend futuro)
```

---

## 📝 TAREAS PARA LA INTEGRACIÓN

### FASE 1: Preparación del Backend (NestJS)

#### 1.1 Crear MT5Service
**Archivo**: `src/modules/ai-trading/services/mt5.service.ts`

**Funcionalidades**:
- [ ] Conectar a MT5 vía Socket (localhost:8080)
- [ ] Obtener precio actual (bid/ask) en tiempo real
- [ ] Obtener datos históricos (OHLC)
- [ ] Obtener información de cuenta (balance, equity)
- [ ] Abrir trades (market orders)
- [ ] Cerrar trades
- [ ] Modificar SL/TP
- [ ] Obtener trades activos
- [ ] Reconexión automática

**Métodos necesarios**:
```typescript
class MT5Service {
  async connect(): Promise<boolean>
  async disconnect(): Promise<void>
  async getPrice(symbol: string): Promise<{ bid: number, ask: number }>
  async getOHLC(symbol: string, timeframe: string, bars: number): Promise<Candle[]>
  async getAccountInfo(): Promise<AccountInfo>
  async openTrade(order: TradeOrder): Promise<TradeResult>
  async closeTrade(ticket: number): Promise<boolean>
  async modifySLTP(ticket: number, sl: number, tp: number): Promise<boolean>
  async getActiveTrades(): Promise<Trade[]>
}
```

#### 1.2 Actualizar ClaudeAIService
**Archivo**: `src/modules/ai-trading/services/claude-ai.service.ts`

- [ ] Modificar para recibir datos de MT5Service en lugar de TwelveData
- [ ] Asegurar que el análisis use precios reales del broker

#### 1.3 Actualizar Controller
**Archivo**: `src/modules/ai-trading/controllers/ai-trading.controller.ts`

- [ ] Modificar `/test-production-flow/:symbol` para usar MT5Service
- [ ] Crear endpoint `/mt5/status` para verificar conexión
- [ ] Crear endpoint `/mt5/account` para ver info de cuenta
- [ ] Actualizar endpoint `/mt5/execute` para usar MT5Service real

#### 1.4 Actualizar Trading Bot Auto Service
**Archivo**: `src/modules/ai-trading/services/trading-bot-auto.service.ts`

- [ ] Cambiar fuente de datos de TwelveData a MT5Service
- [ ] Mantener lógica de escaneo automático

---

### FASE 2: Crear Bridge MT5 (MQL5)

#### 2.1 Expert Advisor de Bridge
**Archivo**: `MT5_Bridge.mq5` (crear en VPS)

**Funcionalidades**:
- [ ] Socket Server escuchando en localhost:8080
- [ ] Recibir comandos JSON del Bot NestJS
- [ ] Ejecutar órdenes en MT5
- [ ] Enviar respuestas JSON al Bot
- [ ] Heartbeat para verificar conexión

**Comandos a implementar**:
```json
// Obtener precio
{ "command": "GET_PRICE", "symbol": "EURUSD" }

// Obtener OHLC
{ "command": "GET_OHLC", "symbol": "EURUSD", "timeframe": "H1", "bars": 100 }

// Abrir trade
{
  "command": "OPEN_TRADE",
  "symbol": "EURUSD",
  "type": "BUY",
  "volume": 0.01,
  "sl": 1.1000,
  "tp": 1.1100,
  "comment": "Claude AI Signal"
}

// Cerrar trade
{ "command": "CLOSE_TRADE", "ticket": 12345 }

// Modificar SL/TP
{ "command": "MODIFY_SLTP", "ticket": 12345, "sl": 1.1050, "tp": 1.1150 }

// Obtener trades activos
{ "command": "GET_TRADES" }

// Obtener info de cuenta
{ "command": "GET_ACCOUNT" }
```

#### 2.2 Librerías MQL5 necesarias
- [ ] Socket library (para comunicación TCP)
- [ ] JSON parser (para parsear comandos)
- [ ] Trade functions (OrderSend, OrderClose, etc.)

---

### FASE 3: Configuración en VPS

#### 3.1 Instalaciones necesarias
- [ ] Node.js v18+ instalado
- [ ] pnpm instalado globalmente
- [ ] PostgreSQL instalado (opcional)
- [ ] Git instalado (para clonar proyecto)

#### 3.2 Subir proyecto al VPS
- [ ] Clonar repositorio o subir vía FTP
- [ ] Instalar dependencias: `pnpm install`
- [ ] Configurar `.env` con variables correctas
- [ ] Ejecutar build: `pnpm run build`

#### 3.3 Variables de entorno en VPS
```env
# .env en VPS
NODE_ENV=production
PORT=3001

# MT5 Connection
MT5_HOST=localhost
MT5_PORT=8080
MT5_TIMEOUT=30000

# Claude AI
ANTHROPIC_API_KEY=tu_api_key

# Telegram
TELEGRAM_BOT_TOKEN=tu_token
TELEGRAM_CHAT_ID=tu_chat_id

# Database (opcional)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=trading_bot
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password

# TwelveData (mantener como backup)
TWELVE_DATA_API_KEY=tu_api_key
```

#### 3.4 Instalar MT5 Bridge
- [ ] Copiar `MT5_Bridge.mq5` a: `C:\Program Files\MetaTrader 5\MQL5\Experts\`
- [ ] Compilar EA en MetaEditor
- [ ] Adjuntar EA a un gráfico
- [ ] Habilitar Auto Trading en MT5
- [ ] Verificar que Socket Server inició correctamente

#### 3.5 Iniciar servicios
- [ ] Iniciar MT5 con EA corriendo
- [ ] Iniciar Bot NestJS: `pnpm run start:prod`
- [ ] Verificar logs de conexión

---

### FASE 4: Testing

#### 4.1 Test de conexión
- [ ] Verificar que NestJS conecta a MT5
- [ ] Endpoint: `GET /mt5/status` debe retornar `{ connected: true }`

#### 4.2 Test de datos
- [ ] Comparar precio de MT5 con precio en plataforma
- [ ] Verificar que no hay desfase

#### 4.3 Test de señales
- [ ] Ejecutar `/test-production-flow/EURUSD`
- [ ] Verificar que precio usado es el de MT5
- [ ] Verificar análisis de Claude con datos correctos

#### 4.4 Test de ejecución (demo primero)
- [ ] Abrir trade de prueba desde el bot
- [ ] Verificar que aparece en MT5
- [ ] Cerrar trade desde el bot
- [ ] Verificar que se cierra en MT5

---

## 🔧 CÓDIGO BASE PARA MT5Service

### Estructura del servicio:

```typescript
// src/modules/ai-trading/services/mt5.service.ts

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as net from 'net';

interface MT5Config {
  host: string;
  port: number;
  timeout: number;
  reconnectDelay: number;
}

interface MT5Price {
  symbol: string;
  bid: number;
  ask: number;
  time: Date;
}

interface MT5Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MT5TradeOrder {
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  sl?: number;
  tp?: number;
  comment?: string;
}

interface MT5TradeResult {
  success: boolean;
  ticket?: number;
  message?: string;
}

@Injectable()
export class MT5Service implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MT5Service.name);
  private client: net.Socket | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly config: MT5Config = {
    host: process.env.MT5_HOST || 'localhost',
    port: parseInt(process.env.MT5_PORT || '8080'),
    timeout: parseInt(process.env.MT5_TIMEOUT || '30000'),
    reconnectDelay: 5000,
  };

  async onModuleInit() {
    this.logger.log('🔌 Iniciando conexión con MT5...');
    await this.connect();
  }

  async onModuleDestroy() {
    this.logger.log('🔌 Cerrando conexión con MT5...');
    await this.disconnect();
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.client = new net.Socket();

        this.client.on('connect', () => {
          this.connected = true;
          this.logger.log(`✅ Conectado a MT5 en ${this.config.host}:${this.config.port}`);
          resolve(true);
        });

        this.client.on('error', (err) => {
          this.logger.error(`❌ Error de conexión MT5: ${err.message}`);
          this.connected = false;
          this.scheduleReconnect();
          resolve(false);
        });

        this.client.on('close', () => {
          this.logger.warn('⚠️ Conexión MT5 cerrada');
          this.connected = false;
          this.scheduleReconnect();
        });

        this.client.connect(this.config.port, this.config.host);
      } catch (error) {
        this.logger.error(`❌ Error al conectar: ${error.message}`);
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    this.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.logger.log('🔄 Intentando reconectar a MT5...');
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectDelay);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async sendCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.client) {
        reject(new Error('No conectado a MT5'));
        return;
      }

      const jsonCommand = JSON.stringify(command) + '\n';

      let responseData = '';

      const onData = (data: Buffer) => {
        responseData += data.toString();

        try {
          const response = JSON.parse(responseData);
          this.client?.removeListener('data', onData);
          resolve(response);
        } catch {
          // Esperando más datos
        }
      };

      this.client.on('data', onData);
      this.client.write(jsonCommand);

      setTimeout(() => {
        this.client?.removeListener('data', onData);
        reject(new Error('Timeout esperando respuesta de MT5'));
      }, this.config.timeout);
    });
  }

  async getPrice(symbol: string): Promise<MT5Price> {
    const response = await this.sendCommand({
      command: 'GET_PRICE',
      symbol: symbol,
    });

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo precio');
    }

    return {
      symbol: response.symbol,
      bid: response.bid,
      ask: response.ask,
      time: new Date(response.time),
    };
  }

  async getOHLC(symbol: string, timeframe: string, bars: number): Promise<MT5Candle[]> {
    const response = await this.sendCommand({
      command: 'GET_OHLC',
      symbol: symbol,
      timeframe: timeframe,
      bars: bars,
    });

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo OHLC');
    }

    return response.candles.map((c: any) => ({
      time: new Date(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
  }

  async getAccountInfo(): Promise<any> {
    const response = await this.sendCommand({
      command: 'GET_ACCOUNT',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo info de cuenta');
    }

    return {
      balance: response.balance,
      equity: response.equity,
      margin: response.margin,
      freeMargin: response.freeMargin,
      profit: response.profit,
    };
  }

  async openTrade(order: MT5TradeOrder): Promise<MT5TradeResult> {
    const response = await this.sendCommand({
      command: 'OPEN_TRADE',
      ...order,
    });

    return {
      success: response.success,
      ticket: response.ticket,
      message: response.message,
    };
  }

  async closeTrade(ticket: number): Promise<boolean> {
    const response = await this.sendCommand({
      command: 'CLOSE_TRADE',
      ticket: ticket,
    });

    return response.success;
  }

  async modifySLTP(ticket: number, sl: number, tp: number): Promise<boolean> {
    const response = await this.sendCommand({
      command: 'MODIFY_SLTP',
      ticket: ticket,
      sl: sl,
      tp: tp,
    });

    return response.success;
  }

  async getActiveTrades(): Promise<any[]> {
    const response = await this.sendCommand({
      command: 'GET_TRADES',
    });

    if (!response.success) {
      throw new Error(response.message || 'Error obteniendo trades');
    }

    return response.trades;
  }
}
```

---

## 📊 CAMBIOS EN testProductionFlow

```typescript
// En ai-trading.controller.ts

async testProductionFlow(@Param('symbol') symbol: string) {
  this.logger.log(`🚀 Iniciando prueba de flujo completo para ${symbol}`);

  try {
    // 1. Verificar conexión MT5
    if (!this.mt5Service.isConnected()) {
      throw new Error('MT5 no está conectado');
    }

    // 2. Obtener precio REAL de MT5
    this.logger.log('📊 Paso 1: Obteniendo datos de MT5...');
    const mt5Price = await this.mt5Service.getPrice(symbol);
    this.logger.log(`✅ Precio obtenido - Bid: ${mt5Price.bid}, Ask: ${mt5Price.ask}`);

    // 3. Obtener datos históricos de MT5
    const ohlcData = await this.mt5Service.getOHLC(symbol, 'H1', 100);

    // 4. Calcular indicadores técnicos con datos reales
    const indicators = this.calculateIndicators(ohlcData);

    // 5. Preparar datos para Claude AI
    this.logger.log('🤖 Paso 2: Preparando análisis Claude AI...');
    const analyzeInput = {
      templateId: 'ai-scalping-v1',
      symbol: symbol,
      timeFrame: '1h',
      marketData: {
        currentPrice: mt5Price.bid, // PRECIO REAL DEL BROKER
        volume: ohlcData[ohlcData.length - 1].volume,
        spread: mt5Price.ask - mt5Price.bid,
        session: this.getCurrentSession(),
      },
      technicalIndicators: indicators,
      customParameters: {
        maxStopLossPips: 30,
        minRiskReward: 1.5,
      },
    };

    // 6. Ejecutar análisis con Claude AI
    this.logger.log('🧠 Paso 3: Ejecutando análisis Claude AI...');
    const claudeResult = await this.claudeAIService.analyzeWithTemplate(analyzeInput);
    this.logger.log(`✅ Análisis completado - Señal: ${claudeResult.signal.signal}`);

    // 7. Crear trade y enviar a Telegram
    this.logger.log('📱 Paso 4: Creando trade y enviando a Telegram...');
    const tradeId = await this.tradingNotificationsService.createTrade(
      claudeResult.signal,
    );
    this.logger.log(`✅ Trade creado: ${tradeId}`);

    // 8. OPCIONAL: Abrir trade real en MT5 (si está configurado)
    if (process.env.AUTO_TRADE === 'true') {
      this.logger.log('🎯 Paso 5: Abriendo trade en MT5...');
      const mt5Result = await this.mt5Service.openTrade({
        symbol: symbol,
        type: claudeResult.signal.signal === 'BUY' ? 'BUY' : 'SELL',
        volume: 0.01, // Tamaño del lote
        sl: claudeResult.signal.stopLoss,
        tp: claudeResult.signal.takeProfit,
        comment: `Claude AI - ${tradeId}`,
      });

      if (mt5Result.success) {
        this.logger.log(`✅ Trade abierto en MT5: Ticket ${mt5Result.ticket}`);
      }
    }

    return {
      success: true,
      data: {
        symbol: symbol,
        marketData: {
          bid: mt5Price.bid,
          ask: mt5Price.ask,
          spread: mt5Price.ask - mt5Price.bid,
          source: 'MT5 Real-Time',
          timestamp: new Date().toISOString(),
        },
        claudeAnalysis: {
          signal: claudeResult.signal.signal,
          confidence: claudeResult.signal.confidence,
          entryPrice: claudeResult.signal.entryPrice,
          stopLoss: claudeResult.signal.stopLoss,
          takeProfit: claudeResult.signal.takeProfit,
          reasoning: claudeResult.signal.reasoning,
        },
        telegramSent: true,
        tradeId: tradeId,
        flowSteps: [
          '✅ MT5 - Datos en tiempo real obtenidos',
          '✅ Claude AI - Análisis completado',
          '✅ Telegram - Señal enviada',
          '✅ Trade - Creado y abierto',
        ],
      },
      message: `Flujo completo ejecutado exitosamente para ${symbol}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    this.logger.error(`❌ Error en flujo completo: ${error.message}`);
    throw error;
  }
}
```

---

## 🎯 CHECKLIST FINAL ANTES DE INTEGRAR

### Información que necesito del usuario:

- [ ] **VPS**: ¿Windows Server o Linux?
- [ ] **RAM disponible**: ¿Cuánta RAM tiene el VPS?
- [ ] **MT5 instalado**: ¿Ya está instalado MT5 en el VPS?
- [ ] **Cuenta**: ¿Demo o Real? (empezar con demo)
- [ ] **Broker**: ¿Qué broker usas? (para configuraciones específicas)
- [ ] **Auto-trading**: ¿Quieres que el bot abra trades automáticamente o solo envíe señales?
- [ ] **Acceso VPS**: ¿Tienes acceso RDP/SSH al VPS?

---

## 📚 RECURSOS ÚTILES

### MQL5 Documentation:
- Socket Programming: https://www.mql5.com/en/docs/network
- OrderSend: https://www.mql5.com/en/docs/trading/ordersend
- JSON Parser: https://www.mql5.com/en/code/18621

### Node.js Socket:
- net module: https://nodejs.org/api/net.html

---

## ⚠️ PRECAUCIONES

1. **Probar SIEMPRE en cuenta DEMO primero**
2. **Verificar precios antes de abrir trades**
3. **Tener Stop Loss SIEMPRE configurado**
4. **Logs detallados para debugging**
5. **Backup de la configuración**
6. **Monitoreo constante los primeros días**

---

## 🚀 ORDEN DE EJECUCIÓN (Más tarde)

1. Crear `MT5Service` en NestJS
2. Crear `MT5_Bridge.mq5` en MQL5
3. Instalar EA en MT5 del VPS
4. Configurar variables de entorno
5. Testear conexión
6. Testear obtención de precios
7. Actualizar `testProductionFlow` para usar MT5
8. Probar señal completa
9. (Opcional) Habilitar auto-trading

---

**FECHA DE CREACIÓN**: 2025-09-30
**ESTADO**: Pendiente de implementación
**PRIORIDAD**: Alta