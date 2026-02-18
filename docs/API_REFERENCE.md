# API Reference - AI Forex Trading Bot Backend

> **Documentación completa del backend NestJS para el frontend Nuxt3**
>
> Base URL: `http://localhost:3000/api`
> Swagger Docs: `http://localhost:3000/api/docs`

## Tabla de Contenidos

1. [Información General](#información-general)
2. [Tipos y Enums](#tipos-y-enums)
3. [Endpoints - Bot Automático](#endpoints---bot-automático)
4. [Endpoints - Telegram](#endpoints---telegram)
5. [Endpoints - Análisis](#endpoints---análisis)
6. [Endpoints - Señales de Trading](#endpoints---señales-de-trading)
7. [Endpoints - Plantillas de Prompts](#endpoints---plantillas-de-prompts)
8. [Endpoints - Gestión de Operaciones](#endpoints---gestión-de-operaciones)
9. [Endpoints - Integración MT5](#endpoints---integración-mt5)
10. [Ejemplos de Respuestas](#ejemplos-de-respuestas)

---

## Información General

### Formato de Respuestas Estándar

Todas las respuestas siguen el formato:

```typescript
// Respuesta exitosa
{
  "success": true,
  "data": any,
  "message": string,
  "timestamp": string,
  "path": string
}

// Respuesta de error
{
  "success": false,
  "error": {
    "code": string,
    "message": string,
    "details": any
  },
  "timestamp": string,
  "path": string
}
```

### Autenticación

Actualmente el API no requiere autenticación (desarrollo). En producción implementar JWT tokens.

---

## Tipos y Enums

### SignalType
```typescript
enum SignalType {
  BUY = 'buy',
  SELL = 'sell',
  HOLD = 'hold'
}
```

### TimeFrame
```typescript
enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
  W1 = '1w'
}
```

### BotInterval
```typescript
enum BotInterval {
  ONE_MINUTE = 60000,      // 1 minuto
  FIVE_MINUTES = 300000,   // 5 minutos
  FIFTEEN_MINUTES = 900000, // 15 minutos
  THIRTY_MINUTES = 1800000, // 30 minutos
  ONE_HOUR = 3600000       // 1 hora
}
```

### TradingSignalDto
```typescript
interface TradingSignalDto {
  symbol: string;              // 'EURUSD'
  type: SignalType;            // 'buy' | 'sell' | 'hold'
  strength: SignalStrength;    // 1-4
  confidence: number;          // 0-100
  timeFrame: TimeFrame;        // '1h', '4h', etc.
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio: number;
  analysis: string;            // Descripción del análisis
  indicators: string[];        // ['RSI', 'MACD', 'EMA']
  timestamp: string;           // ISO date
  signalId: string;
  strategy: string;            // 'scalping', 'swing', etc.
}
```

### AnalysisResultDto
```typescript
interface AnalysisResultDto {
  symbol: string;
  primaryTrend: 'bullish' | 'bearish' | 'sideways';
  marketCondition: 'trending' | 'ranging' | 'volatile' | 'consolidating';
  currentPrice: number;
  volatility: number;
  relativeVolume: number;
  technicalIndicators: TechnicalIndicatorResult[];
  supportLevels: SupportResistanceDto[];
  resistanceLevels: SupportResistanceDto[];
  patterns: PatternRecognitionDto[];
  marketSentiment: MarketSentimentDto;
  overallScore: number;        // 0-100
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  analysisExplanation: string;
  riskFactors: string[];
  opportunities: string[];
  timestamp: string;
  timeFrame: string;
  analysisId: string;
}
```

---

## Endpoints - Bot Automático

### 🚀 POST `/ai-trading/bot/start`
**Iniciar bot de trading automático**

Inicia el bot para monitorear mercados automáticamente y generar señales.

**Request:** Ninguno

**Response:**
```typescript
{
  success: boolean;
  message: string;
  config?: {
    symbols: string[];
    interval: number;
    minConfidence: number;
  }
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/ai-trading/bot/start
```

---

### 🛑 POST `/ai-trading/bot/stop`
**Detener bot de trading automático**

Detiene el bot y finaliza el monitoreo automático.

**Request:** Ninguno

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 📊 GET `/ai-trading/bot/status`
**Obtener estado del bot**

Recupera el estado actual del bot incluyendo configuración y estadísticas.

**Response:**
```typescript
{
  isRunning: boolean;
  config: {
    symbols: string[];           // ['EURUSD', 'GBPUSD', ...]
    interval: number;            // en milisegundos
    minConfidence: number;       // 0-100
    timeFrame: string;           // '1h', '4h', etc.
    strategy: string;            // 'ai-scalping-v1'
  };
  stats: {
    totalScans: number;
    signalsGenerated: number;
    lastScanTime: string | null; // ISO date
    nextScanTime: string | null; // ISO date
    uptime: number;              // en milisegundos
  };
}
```

---

### ⚙️ POST `/ai-trading/bot/config`
**Actualizar configuración del bot**

Actualiza la configuración del bot (símbolos, intervalo, confianza mínima, etc).

**Request:**
```typescript
{
  symbols?: string[];           // ['EURUSD', 'USDJPY']
  interval?: number;            // 300000 (5 minutos)
  minConfidence?: number;       // 70
  timeFrame?: string;           // '1h'
  strategy?: string;            // 'ai-scalping-v1'
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
  updatedConfig: {
    symbols: string[];
    interval: number;
    minConfidence: number;
    timeFrame: string;
    strategy: string;
  }
}
```

---

### 🔄 POST `/ai-trading/bot/reset-stats`
**Resetear estadísticas del bot**

Reinicia las estadísticas del bot a cero.

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 📅 GET `/ai-trading/bot/intervals`
**Obtener intervalos disponibles**

Lista todos los intervalos de escaneo disponibles para el bot.

**Response:**
```typescript
[
  {
    label: string;      // '1 minuto'
    value: number;      // 60000
    minutes: number;    // 1
  }
]
```

---

## Endpoints - Telegram

### 📱 GET `/ai-trading/telegram/status`
**Estado del servicio Telegram Bot**

Verifica si el bot de Telegram está configurado y activo.

**Response:**
```typescript
{
  enabled: boolean;
  connected: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  status: 'connected' | 'disconnected' | 'not_configured';
}
```

---

### ✅ GET `/ai-trading/telegram/validate`
**Validar conexión con Telegram**

Verifica si el bot puede conectarse correctamente con la API de Telegram.

**Response:**
```typescript
{
  connected: boolean;
  botInfo: {
    enabled: boolean;
    connected: boolean;
    hasToken: boolean;
    hasChatId: boolean;
    status: string;
  };
  timestamp: string;
  message: string;
}
```

---

### 📤 POST `/ai-trading/telegram/test`
**Enviar mensaje de prueba a Telegram**

Envía una señal de trading de prueba al canal de Telegram configurado.

**Response:**
```typescript
{
  success: boolean;
  sent: boolean;
  message: string;
}
```

---

### 🔄 POST `/ai-trading/telegram/test-reconnect`
**Probar reconexión automática de Telegram**

Fuerza una reconexión y verifica que el sistema se recupere automáticamente.

**Response:**
```typescript
{
  success: boolean;
  reconnected: boolean;
  testMessageSent: boolean;
  initialStatus: object;
  finalStatus: object;
  message: string;
  timestamp: string;
}
```

---

### 🤖 POST `/ai-trading/telegram/send-claude-analysis`
**Enviar análisis de Claude a Telegram**

Analiza un símbolo con Claude AI y envía el resultado a Telegram.

**Request:**
```typescript
{
  symbol: string;      // 'EURUSD'
  timeFrame: string;   // '1h'
}
```

**Response:**
```typescript
{
  success: boolean;
  analysis: object;
  telegramSent: boolean;
  message: string;
}
```

---

## Endpoints - Análisis

### 🏥 GET `/ai-trading/health`
**Verificar estado del servicio AI Trading**

Endpoint para verificar que el servicio está funcionando correctamente.

**Response:**
```typescript
{
  status: 'healthy';
  uptime: number;
  signalStats: object;
  timestamp: string;
}
```

---

### 🔍 POST `/ai-trading/analyze`
**Realizar análisis AI de un símbolo**

Ejecuta un análisis completo usando inteligencia artificial para un par de divisas.

**Request:**
```typescript
{
  symbol: string;      // 'EURUSD'
  timeFrame?: string;  // '1h' (default)
}
```

**Response:** `AnalysisResultDto`

---

### 🚀 GET `/ai-trading/analyze/:symbol`
**Análisis AI rápido por símbolo**

Versión GET para análisis rápido de un símbolo específico.

**Path Parameters:**
- `symbol`: Símbolo del par de divisas (ej: EURUSD)

**Query Parameters:**
- `timeFrame` (optional): Marco temporal para el análisis (default: '1h')

**Response:** `AnalysisResultDto`

---

### 📊 POST `/ai-trading/analyze/batch`
**Análisis AI rápido para múltiples símbolos**

Ejecuta análisis rápido en paralelo para una lista de símbolos.

**Request:**
```typescript
{
  symbols: string[];   // ['EURUSD', 'GBPUSD', 'USDJPY']
}
```

**Response:**
```typescript
[
  {
    symbol: string;
    trend: 'bullish' | 'bearish' | 'sideways';
    score: number;
    recommendation: string;
  }
]
```

---

### 🔗 GET `/ai-trading/correlation/:symbol1/:symbol2`
**Analizar correlación entre dos símbolos**

Calcula la correlación estadística entre dos pares de divisas.

**Path Parameters:**
- `symbol1`: Primer símbolo (ej: EURUSD)
- `symbol2`: Segundo símbolo (ej: GBPUSD)

**Query Parameters:**
- `period` (optional): Periodo de análisis (default: 50)

**Response:**
```typescript
{
  correlation: number;
  strength: 'strong' | 'moderate' | 'weak';
  relationship: 'positive' | 'negative' | 'neutral';
}
```

---

### 🧠 POST `/ai-trading/analyze/advanced`
**Análisis avanzado con Claude AI**

Ejecuta análisis completo usando Claude AI con indicadores técnicos avanzados.

**Request:**
```typescript
{
  symbol: string;      // 'EURUSD'
  timeFrame?: string;  // '1h'
}
```

**Response:** `AnalysisResultDto`

---

### 📈 POST `/ai-trading/analyze/multi-timeframe`
**Análisis multi-timeframe con Claude AI**

Analiza un símbolo en múltiples timeframes y genera consenso.

**Request:**
```typescript
{
  symbol: string;   // 'EURUSD'
}
```

**Response:**
```typescript
{
  timeframes: {
    [key: string]: AnalysisResultDto;
  };
  consensus: {
    overallTrend: string;
    confidenceScore: number;
    recommendation: string;
    reasoning: string;
  };
}
```

---

### 📝 POST `/ai-trading/analyze/with-template`
**Analizar con plantilla personalizada**

Ejecuta análisis usando una plantilla de prompt específica.

**Request:** `AnalyzeWithTemplateDto`
```typescript
{
  templateId: string;          // 'ai-scalping-v1'
  symbol: string;              // 'EURUSD'
  timeFrame: string;           // '1h'
  marketData: {
    currentPrice: number;
    volume?: number;
    spread?: number;
    session?: string;
  };
  technicalIndicators: {
    rsi?: number;
    macd?: string;
    ema20?: number;
    ema50?: number;
    bollingerBands?: string;
    volume?: number;
    atr?: number;
    [key: string]: any;
  };
  customParameters?: Record<string, any>;
}
```

**Response:**
```typescript
{
  success: boolean;
  signal: TradingSignalDto;
  executionTime: number;
  timestamp: string;
}
```

---

### 🔬 POST `/ai-trading/claude/test-analysis`
**Probar análisis directo de Claude AI**

Ejecuta un análisis directo con Claude AI para verificar que está funcionando.

**Request:**
```typescript
{
  symbol: string;      // 'EURUSD'
  timeFrame: string;   // '1h'
}
```

**Response:**
```typescript
{
  success: boolean;
  claudeAnalysis: object;
  inputData: object;
  timestamp: string;
  note: string;
}
```

---

### ✅ GET `/ai-trading/claude/status`
**Verificar estado de Claude AI**

Verifica la conectividad y estado del servicio Claude AI.

**Response:**
```typescript
{
  connected: boolean;
  status: 'active' | 'disconnected';
  timestamp: string;
}
```

---

### 🧪 GET `/ai-trading/test-production-flow/:symbol`
**Prueba flujo completo de bot trading**

Simula el flujo completo: TwelveData → Claude AI → Telegram como sería en operación real.

**Path Parameters:**
- `symbol`: Símbolo a analizar (USDJPY, EURUSD, GBPUSD, etc.)

**Response:**
```typescript
{
  success: boolean;
  data: {
    symbol: string;
    marketData: {
      price: string;
      source: 'TwelveData';
      timestamp: string;
    };
    claudeAnalysis: {
      signal: string;
      confidence: number;
      entryPrice: number;
      stopLoss: number;
      takeProfit: number;
      reasoning: string;
    };
    telegramSent: boolean;
    tradeId: string;
    flowSteps: string[];
  };
  message: string;
  timestamp: string;
}
```

---

## Endpoints - Señales de Trading

### 🎯 POST `/ai-trading/signals/generate`
**Generar señal de trading**

Genera una señal de trading basada en análisis AI para un símbolo específico.

**Request:** `CreateSignalDto`
```typescript
{
  symbol: string;        // 'EURUSD'
  timeFrame: TimeFrame;  // TimeFrame.H1
  strategy?: string;     // 'moderate' (optional)
}
```

**Response:** `TradingSignalDto` (o `null` si no se cumplieron los criterios)

**Status Codes:**
- `201`: Señal generada exitosamente
- `204`: No se pudo generar señal (criterios no cumplidos)

---

### 📦 POST `/ai-trading/signals/batch`
**Generar señales para múltiples símbolos**

Genera señales de trading en batch para una lista de símbolos.

**Request:**
```typescript
{
  symbols: string[];           // ['EURUSD', 'GBPUSD', 'USDJPY']
  timeFrame?: TimeFrame;       // TimeFrame.H1 (default)
  strategy?: string;           // 'moderate' (default)
}
```

**Response:** `TradingSignalDto[]`

---

### 🔎 GET `/ai-trading/signals`
**Obtener señales de trading**

Recupera señales de trading basadas en filtros especificados.

**Query Parameters:**
- `symbol` (optional): Filtrar por símbolo
- `type` (optional): Tipo de señal ('buy', 'sell', 'hold')
- `timeFrame` (optional): Marco temporal
- `minConfidence` (optional): Confianza mínima (0-100)
- `limit` (optional): Número máximo de señales (default: 10)

**Response:** `TradingSignalDto[]`

---

### 🟢 GET `/ai-trading/signals/active`
**Obtener señales activas**

Recupera todas las señales generadas en las últimas 24 horas.

**Response:** `TradingSignalDto[]`

---

### 📊 GET `/ai-trading/signals/performance`
**Analizar rendimiento de señales**

Obtiene estadísticas de rendimiento de las señales generadas.

**Query Parameters:**
- `symbol` (optional): Analizar rendimiento para símbolo específico

**Response:**
```typescript
{
  totalSignals: number;
  winRate: number;
  avgRiskReward: number;
  profitFactor: number;
  bestStrategy: string;
}
```

---

### ✔️ POST `/ai-trading/signals/validate`
**Validar señal de trading**

Valida una señal de trading antes de su ejecución.

**Request:** `TradingSignalDto`

**Response:**
```typescript
{
  isValid: boolean;
  reasons: string[];
}
```

---

### 🚀 POST `/ai-trading/signals/advanced`
**Generar señal avanzada con Claude AI**

Genera señal de trading usando estrategias avanzadas y análisis de Claude AI.

**Request:** `CreateSignalDto`

**Response:** `TradingSignalDto` (o `null` si no se cumplieron los criterios)

**Status Codes:**
- `201`: Señal generada exitosamente
- `204`: No se pudo generar señal

---

### 💼 POST `/ai-trading/signals/portfolio`
**Generar señales de portafolio balanceado**

Genera múltiples señales optimizadas para un portafolio diversificado.

**Request:**
```typescript
{
  symbols: string[];           // ['EURUSD', 'GBPUSD', 'USDJPY']
  strategy?: string;           // 'ai_day_trading' (default)
  maxSignals?: number;         // 3 (default)
}
```

**Response:** `TradingSignalDto[]`

---

### 📜 GET `/ai-trading/signals/history`
**Obtener historial de señales avanzadas**

Recupera el historial de señales generadas por el sistema avanzado.

**Query Parameters:**
- `symbol` (optional): Símbolo específico

**Response:** `TradingSignalDto[]`

---

## Endpoints - Estrategias

### 📋 GET `/ai-trading/strategies`
**Obtener estrategias disponibles**

Lista todas las estrategias de trading disponibles.

**Response:**
```typescript
[
  {
    name: string;              // 'conservative'
    description: string;
    minConfidence: number;     // 80
    riskRewardRatio: number;   // 2.0
    stopLossPercentage: number;    // 1.0
    takeProfitPercentage: number;  // 2.0
  }
]
```

**Estrategias disponibles:**
- `conservative`: Alta confianza, bajo riesgo (min confidence: 80)
- `moderate`: Riesgo moderado (min confidence: 65)
- `aggressive`: Mayor tolerancia al riesgo (min confidence: 50)
- `scalping`: Operaciones rápidas (min confidence: 70)

---

### 🎯 GET `/ai-trading/strategies/advanced`
**Obtener estrategias avanzadas con IA**

Lista todas las estrategias avanzadas disponibles.

**Response:** `AdvancedStrategyDto[]`

```typescript
[
  {
    name: string;                  // 'AI Scalping'
    description: string;
    minConfidence: number;         // 75
    riskRewardRatio: number;       // 1.5
    stopLossPercentage: number;    // 0.3
    takeProfitPercentage: number;  // 0.45
    timeHorizon: string;           // '5m-30m'
    maxRiskPerTrade: number;       // 1
    requiresMultiTimeframe: boolean;
    tradingStyle: TradingStyle;    // 'scalping'
  }
]
```

---

## Endpoints - Plantillas de Prompts

### 📝 GET `/ai-trading/templates`
**Obtener todas las plantillas de prompts**

Lista todas las plantillas de prompts disponibles para Claude AI.

**Response:**
```typescript
[
  {
    id: string;
    name: string;
    description: string;
    strategy: string;
    isActive: boolean;
  }
]
```

---

### 🔍 GET `/ai-trading/templates/:id`
**Obtener plantilla específica**

Recupera una plantilla de prompt específica por ID.

**Path Parameters:**
- `id`: ID de la plantilla

**Response:** Template object

---

### ➕ POST `/ai-trading/templates`
**Crear nueva plantilla de prompt**

Crea una nueva plantilla personalizada para análisis con Claude AI.

**Request:** `CreateTemplateDto`
```typescript
{
  name: string;
  description: string;
  strategy: 'SCALPING' | 'SWING' | 'BREAKOUT' | 'TREND_FOLLOWING' | 'MEAN_REVERSION';
  systemPrompt: string;
  userPromptTemplate: string;
  responseFormat: any;
  isActive?: boolean;
  parameters?: PromptParameterDto[];
}
```

**Response:** Created template object

---

### ✏️ POST `/ai-trading/templates/:id`
**Actualizar plantilla existente**

Actualiza una plantilla de prompt existente.

**Path Parameters:**
- `id`: ID de la plantilla

**Request:** `Partial<CreateTemplateDto>`

**Response:** Updated template object

---

## Endpoints - Gestión de Operaciones

### ➕ POST `/ai-trading/trades/create`
**Crear nueva operación de trading**

Crea una nueva operación y envía la señal a Telegram.

**Request:** Signal object (any)

**Response:**
```typescript
{
  tradeId: string;
  signal: object;
  status: 'created';
  message: string;
}
```

---

### 🟢 POST `/ai-trading/trades/:tradeId/open`
**Abrir operación**

Marca una operación como abierta con el precio real de ejecución.

**Path Parameters:**
- `tradeId`: ID de la operación

**Request:**
```typescript
{
  actualPrice: number;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 🔄 POST `/ai-trading/trades/:tradeId/update`
**Actualizar operación**

Envía una actualización de la operación (SL, TP, trailing stop, etc.).

**Path Parameters:**
- `tradeId`: ID de la operación

**Request:** `TradingUpdateDto`
```typescript
{
  tradeId: string;
  updateType: 'SL_HIT' | 'TP_HIT' | 'SL_MODIFIED' | 'TP_MODIFIED' |
              'TRAILING_STOP' | 'BREAKEVEN' | 'POSITION_OPENED' | 'POSITION_CLOSED';
  currentPrice: number;
  details: {
    oldValue?: number;
    newValue?: number;
    reason?: string;
    pnl?: number;
    percentage?: number;
  };
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 🔴 POST `/ai-trading/trades/:tradeId/close`
**Cerrar operación**

Cierra una operación y envía el resultado final.

**Path Parameters:**
- `tradeId`: ID de la operación

**Request:**
```typescript
{
  closePrice: number;
  reason: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  message: string;
}
```

---

### 📊 GET `/ai-trading/trades/active`
**Obtener operaciones activas**

Lista todas las operaciones actualmente abiertas.

**Response:** Array of trade objects

---

### 🔍 GET `/ai-trading/trades/:tradeId`
**Obtener detalles de operación**

Recupera los detalles completos de una operación específica.

**Path Parameters:**
- `tradeId`: ID de la operación

**Response:** Trade object

---

### 📋 GET `/ai-trading/trades`
**Obtener todas las operaciones**

Lista todas las operaciones (activas y cerradas).

**Response:** Array of trade objects

---

## Endpoints - Integración MT5

### 🔄 POST `/ai-trading/mt5/signal`
**Convertir señal a formato MT5**

Convierte una señal de IA al formato compatible con MetaTrader 5.

**Request:** Signal object (any)

**Response:**
```typescript
{
  mt5Signal: MT5SignalDto;
  originalSignal: object;
  executionInstructions: string;
  timestamp: string;
}
```

**MT5SignalDto:**
```typescript
{
  symbol: string;
  orderType: 'BUY' | 'SELL';
  lotSize: number;           // 0.01 - 1.0
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  comment?: string;
  magicNumber?: number;
  slippage?: number;
}
```

---

### 🚀 POST `/ai-trading/mt5/execute`
**Ejecutar señal en MT5**

Envía una señal para ejecución directa en MetaTrader 5.

**Request:** `MT5SignalDto`

**Response:**
```typescript
{
  executed: boolean;
  orderId: string;
  message: string;
  signal: MT5SignalDto;
  timestamp: string;
  note: string;
}
```

---

## Endpoints - Estadísticas

### 📊 GET `/ai-trading/stats`
**Estadísticas del servicio AI Trading**

Obtiene estadísticas generales del servicio de AI Trading.

**Response:**
```typescript
{
  signalGenerator: object;
  uptime: number;
  timestamp: string;
}
```

---

## Ejemplos de Respuestas

### Ejemplo: Señal de Trading Completa

```json
{
  "symbol": "EURUSD",
  "type": "buy",
  "strength": 3,
  "confidence": 78,
  "timeFrame": "1h",
  "entryPrice": 1.0850,
  "stopLoss": 1.0820,
  "takeProfit": 1.0910,
  "riskRewardRatio": 2.0,
  "analysis": "Tendencia alcista confirmada con RSI en zona de sobreventa y MACD cruzando al alza",
  "indicators": ["RSI", "MACD", "EMA_20", "EMA_50"],
  "timestamp": "2025-09-29T10:30:00.000Z",
  "signalId": "sig_1727608200000_EURUSD",
  "strategy": "ai-scalping-v1"
}
```

### Ejemplo: Estado del Bot

```json
{
  "isRunning": true,
  "config": {
    "symbols": ["EURUSD", "GBPUSD", "USDJPY"],
    "interval": 300000,
    "minConfidence": 70,
    "timeFrame": "1h",
    "strategy": "ai-scalping-v1"
  },
  "stats": {
    "totalScans": 142,
    "signalsGenerated": 8,
    "lastScanTime": "2025-09-29T10:25:00.000Z",
    "nextScanTime": "2025-09-29T10:30:00.000Z",
    "uptime": 7200000
  }
}
```

### Ejemplo: Análisis Completo

```json
{
  "symbol": "EURUSD",
  "primaryTrend": "bullish",
  "marketCondition": "trending",
  "currentPrice": 1.0850,
  "volatility": 0.15,
  "relativeVolume": 1.2,
  "technicalIndicators": [
    {
      "name": "RSI",
      "value": 55.5,
      "signal": "neutral",
      "confidence": 70,
      "parameters": { "period": 14 }
    },
    {
      "name": "MACD",
      "value": 0.001,
      "signal": "buy",
      "confidence": 75,
      "parameters": { "fast": 12, "slow": 26, "signal": 9 }
    }
  ],
  "supportLevels": [
    {
      "price": 1.0820,
      "type": "major",
      "strength": 85,
      "touches": 3,
      "distanceInPips": 30
    }
  ],
  "resistanceLevels": [
    {
      "price": 1.0910,
      "type": "major",
      "strength": 80,
      "touches": 2,
      "distanceInPips": 60
    }
  ],
  "patterns": [],
  "marketSentiment": {
    "sentiment": 65,
    "sources": ["technical_analysis"],
    "newsAnalysis": "Mercado alcista con buen volumen",
    "upcomingEvents": []
  },
  "overallScore": 72,
  "recommendation": "buy",
  "analysisExplanation": "Tendencia alcista confirmada con múltiples indicadores...",
  "riskFactors": ["Alta volatilidad en sesión asiática"],
  "opportunities": ["Ruptura de resistencia menor en 1.0880"],
  "timestamp": "2025-09-29T10:30:00.000Z",
  "timeFrame": "1h",
  "analysisId": "analysis_1727608200000"
}
```

---

## Variables de Entorno Requeridas

```env
# Claude AI
ANTHROPIC_API_KEY=tu_api_key_de_anthropic

# Telegram Bot
TELEGRAM_BOT_TOKEN=tu_bot_token
TELEGRAM_CHAT_ID=tu_chat_id

# TwelveData (Market Data)
TWELVE_DATA_API_KEY=tu_api_key_de_twelvedata

# Database (PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password
DATABASE_NAME=base_architecture_db

# Application
PORT=3000
NODE_ENV=development
```

---

## Notas Importantes para el Frontend

1. **Polling para Bot Status**: El frontend debe hacer polling cada 5-10 segundos a `/bot/status` para actualizar el estado en tiempo real.

2. **WebSocket futuro**: Considerar implementar WebSocket para notificaciones en tiempo real de señales nuevas.

3. **Paginación**: Los endpoints que retornan arrays grandes (`/signals`, `/trades`) deberían implementar paginación en futuras versiones.

4. **Rate Limiting**: Considerar implementar rate limiting en producción, especialmente para endpoints de análisis que consumen Claude AI.

5. **Errores comunes**:
   - `401`: Token de Telegram inválido
   - `429`: Rate limit de Claude AI alcanzado
   - `500`: Error interno (revisar logs del servidor)

6. **Formato de fechas**: Todas las fechas están en formato ISO 8601 UTC.

7. **Símbolos soportados**:
   - Forex: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD, EURGBP, EURJPY
   - Metales: XAUUSD (Gold), XAGUSD (Silver)

---

## Endpoints a Implementar (Roadmap)

- [ ] `GET /ai-trading/performance/report` - Reporte de rendimiento detallado
- [ ] `POST /ai-trading/backtest` - Sistema de backtesting
- [ ] `GET /ai-trading/alerts` - Sistema de alertas configurables
- [ ] `POST /ai-trading/bot/schedule` - Programar inicio/parada del bot
- [ ] `WebSocket /ai-trading/realtime` - Conexión WebSocket para updates en tiempo real

---

**Última actualización:** 2025-09-29
**Versión del API:** 1.0.0
**Backend:** NestJS + TypeScript + PostgreSQL
**IA:** Claude 3.5 Sonnet (Anthropic)
**Market Data:** TwelveData API