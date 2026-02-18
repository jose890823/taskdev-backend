/**
 * API Types - AI Forex Trading Bot Backend
 *
 * Este archivo contiene todos los tipos TypeScript del backend
 * para ser usado en el frontend Nuxt3.
 *
 * Copiar a: types/api.ts en el proyecto frontend
 */

// ==================== ENUMS ====================

export enum SignalType {
  BUY = 'buy',
  SELL = 'sell',
  HOLD = 'hold',
}

export enum SignalStrength {
  WEAK = 1,
  MODERATE = 2,
  STRONG = 3,
  VERY_STRONG = 4,
}

export enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H4 = '4h',
  D1 = '1d',
  W1 = '1w',
}

export enum TrendDirection {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  SIDEWAYS = 'sideways',
}

export enum MarketCondition {
  TRENDING = 'trending',
  RANGING = 'ranging',
  VOLATILE = 'volatile',
  CONSOLIDATING = 'consolidating',
}

export enum SupportResistanceLevel {
  MAJOR = 'major',
  MINOR = 'minor',
  DYNAMIC = 'dynamic',
}

export enum TradingStyle {
  SCALPING = 'scalping',
  DAY_TRADING = 'day_trading',
  SWING_TRADING = 'swing_trading',
  POSITION_TRADING = 'position_trading',
}

export enum BotInterval {
  ONE_MINUTE = 60000,
  FIVE_MINUTES = 300000,
  FIFTEEN_MINUTES = 900000,
  THIRTY_MINUTES = 1800000,
  ONE_HOUR = 3600000,
}

export enum UpdateType {
  SL_HIT = 'SL_HIT',
  TP_HIT = 'TP_HIT',
  SL_MODIFIED = 'SL_MODIFIED',
  TP_MODIFIED = 'TP_MODIFIED',
  TRAILING_STOP = 'TRAILING_STOP',
  BREAKEVEN = 'BREAKEVEN',
  POSITION_OPENED = 'POSITION_OPENED',
  POSITION_CLOSED = 'POSITION_CLOSED',
}

export enum PromptStrategy {
  SCALPING = 'SCALPING',
  SWING = 'SWING',
  BREAKOUT = 'BREAKOUT',
  TREND_FOLLOWING = 'TREND_FOLLOWING',
  MEAN_REVERSION = 'MEAN_REVERSION',
}

// ==================== INTERFACES - SEÑALES ====================

export interface TradingSignalDto {
  symbol: string;
  type: SignalType;
  strength: SignalStrength;
  confidence: number;
  timeFrame: TimeFrame;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio: number;
  analysis: string;
  indicators: string[];
  timestamp: string;
  signalId: string;
  strategy: string;
}

export interface CreateSignalDto {
  symbol: string;
  timeFrame: TimeFrame;
  strategy?: string;
}

export interface SignalFilterDto {
  symbol?: string;
  type?: SignalType;
  timeFrame?: TimeFrame;
  minConfidence?: number;
  limit?: number;
}

// ==================== INTERFACES - ANÁLISIS ====================

export interface TechnicalIndicatorResult {
  name: string;
  value: number;
  signal: 'buy' | 'sell' | 'neutral';
  confidence: number;
  parameters: Record<string, any>;
}

export interface SupportResistanceDto {
  price: number;
  type: SupportResistanceLevel;
  strength: number;
  touches: number;
  distanceInPips: number;
}

export interface PatternRecognitionDto {
  pattern: string;
  type: 'reversal' | 'continuation' | 'neutral';
  reliability: number;
  timeFrame: string;
  description: string;
}

export interface MarketSentimentDto {
  sentiment: number;
  sources: string[];
  newsAnalysis: string;
  upcomingEvents: Array<{
    date: string;
    event: string;
    impact: 'low' | 'medium' | 'high';
    forecast?: string;
  }>;
}

export interface AnalysisResultDto {
  symbol: string;
  primaryTrend: TrendDirection;
  marketCondition: MarketCondition;
  currentPrice: number;
  volatility: number;
  relativeVolume: number;
  technicalIndicators: TechnicalIndicatorResult[];
  supportLevels: SupportResistanceDto[];
  resistanceLevels: SupportResistanceDto[];
  patterns: PatternRecognitionDto[];
  marketSentiment: MarketSentimentDto;
  overallScore: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  analysisExplanation: string;
  riskFactors: string[];
  opportunities: string[];
  timestamp: string;
  timeFrame: string;
  analysisId: string;
}

// ==================== INTERFACES - ESTRATEGIAS ====================

export interface StrategyDto {
  name: string;
  description: string;
  minConfidence: number;
  riskRewardRatio: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
}

export interface AdvancedStrategyDto {
  name: string;
  description: string;
  minConfidence: number;
  riskRewardRatio: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  timeHorizon: string;
  maxRiskPerTrade: number;
  requiresMultiTimeframe: boolean;
  tradingStyle: TradingStyle;
}

// ==================== INTERFACES - BOT ====================

export interface BotConfig {
  symbols: string[];
  interval: number;
  minConfidence: number;
  timeFrame: string;
  strategy: string;
}

export interface BotStats {
  totalScans: number;
  signalsGenerated: number;
  lastScanTime: string | null;
  nextScanTime: string | null;
  uptime: number;
}

export interface BotStatus {
  isRunning: boolean;
  config: BotConfig;
  stats: BotStats;
}

export interface BotConfigUpdate {
  symbols?: string[];
  interval?: number;
  minConfidence?: number;
  timeFrame?: string;
  strategy?: string;
}

export interface BotIntervalOption {
  label: string;
  value: number;
  minutes: number;
}

// ==================== INTERFACES - TELEGRAM ====================

export interface TelegramStatus {
  enabled: boolean;
  connected: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  status: 'connected' | 'disconnected' | 'not_configured';
}

export interface TelegramValidation {
  connected: boolean;
  botInfo: TelegramStatus;
  timestamp: string;
  message: string;
}

export interface TelegramTestResponse {
  success: boolean;
  sent: boolean;
  message: string;
}

export interface TelegramReconnectResponse {
  success: boolean;
  reconnected: boolean;
  testMessageSent: boolean;
  initialStatus: TelegramStatus;
  finalStatus: TelegramStatus;
  message: string;
  timestamp: string;
}

// ==================== INTERFACES - PLANTILLAS ====================

export interface PromptParameterDto {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  defaultValue: any;
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface CreateTemplateDto {
  name: string;
  description: string;
  strategy: PromptStrategy;
  systemPrompt: string;
  userPromptTemplate: string;
  responseFormat: any;
  isActive?: boolean;
  parameters?: PromptParameterDto[];
}

export interface TemplateDto {
  id: string;
  name: string;
  description: string;
  strategy: string;
  isActive: boolean;
  systemPrompt?: string;
  userPromptTemplate?: string;
  responseFormat?: any;
  parameters?: PromptParameterDto[];
}

export interface AnalyzeWithTemplateDto {
  templateId: string;
  symbol: string;
  timeFrame: string;
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

export interface AnalyzeWithTemplateResponse {
  success: boolean;
  signal: TradingSignalDto;
  executionTime: number;
  timestamp: string;
}

// ==================== INTERFACES - OPERACIONES ====================

export interface TradingUpdateDto {
  tradeId: string;
  updateType: UpdateType;
  currentPrice: number;
  details: {
    oldValue?: number;
    newValue?: number;
    reason?: string;
    pnl?: number;
    percentage?: number;
  };
}

export interface TradeDto {
  tradeId: string;
  signal: TradingSignalDto;
  status: 'created' | 'opened' | 'closed';
  openPrice?: number;
  closePrice?: number;
  pnl?: number;
  openedAt?: string;
  closedAt?: string;
  updates: TradingUpdateDto[];
}

export interface CreateTradeResponse {
  tradeId: string;
  signal: any;
  status: string;
  message: string;
}

// ==================== INTERFACES - MT5 ====================

export interface MT5SignalDto {
  symbol: string;
  orderType: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  comment?: string;
  magicNumber?: number;
  slippage?: number;
}

export interface MT5ConversionResponse {
  mt5Signal: MT5SignalDto;
  originalSignal: any;
  executionInstructions: string;
  timestamp: string;
}

export interface MT5ExecutionResponse {
  executed: boolean;
  orderId: string;
  message: string;
  signal: MT5SignalDto;
  timestamp: string;
  note: string;
}

// ==================== INTERFACES - API RESPONSES ====================

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  path?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path?: string;
}

export interface HealthResponse {
  status: 'healthy';
  uptime: number;
  signalStats: any;
  timestamp: string;
}

export interface StatsResponse {
  signalGenerator: any;
  uptime: number;
  timestamp: string;
}

export interface ClaudeStatusResponse {
  connected: boolean;
  status: 'active' | 'disconnected';
  timestamp: string;
}

export interface ClaudeTestAnalysisResponse {
  success: boolean;
  claudeAnalysis: any;
  inputData: any;
  timestamp: string;
  note: string;
}

export interface CorrelationResponse {
  correlation: number;
  strength: 'strong' | 'moderate' | 'weak';
  relationship: 'positive' | 'negative' | 'neutral';
}

export interface SignalPerformanceResponse {
  totalSignals: number;
  winRate: number;
  avgRiskReward: number;
  profitFactor: number;
  bestStrategy: string;
}

export interface SignalValidationResponse {
  isValid: boolean;
  reasons: string[];
}

export interface MultiTimeframeAnalysis {
  timeframes: Record<string, AnalysisResultDto>;
  consensus: {
    overallTrend: string;
    confidenceScore: number;
    recommendation: string;
    reasoning: string;
  };
}

export interface ProductionFlowResponse {
  success: boolean;
  data: {
    symbol: string;
    marketData: {
      price: string;
      source: string;
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

export interface BatchAnalysisResult {
  symbol: string;
  trend: TrendDirection;
  score: number;
  recommendation: string;
}

// ==================== INTERFACES - REQUEST BODIES ====================

export interface AnalyzeSymbolRequest {
  symbol: string;
  timeFrame?: string;
}

export interface BatchAnalysisRequest {
  symbols: string[];
}

export interface GenerateBatchSignalsRequest {
  symbols: string[];
  timeFrame?: TimeFrame;
  strategy?: string;
}

export interface GeneratePortfolioSignalsRequest {
  symbols: string[];
  strategy?: string;
  maxSignals?: number;
}

export interface OpenTradeRequest {
  actualPrice: number;
}

export interface CloseTradeRequest {
  closePrice: number;
  reason: string;
}

export interface SendClaudeAnalysisRequest {
  symbol: string;
  timeFrame: string;
}

// ==================== CONSTANTES ====================

export const SUPPORTED_SYMBOLS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'EURGBP',
  'EURJPY',
  'XAUUSD',
  'XAGUSD',
] as const;

export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number];

export const DEFAULT_STRATEGIES = [
  'conservative',
  'moderate',
  'aggressive',
  'scalping',
] as const;

export type DefaultStrategy = typeof DEFAULT_STRATEGIES[number];

export const TIMEFRAME_LABELS: Record<TimeFrame, string> = {
  [TimeFrame.M1]: '1 Minuto',
  [TimeFrame.M5]: '5 Minutos',
  [TimeFrame.M15]: '15 Minutos',
  [TimeFrame.M30]: '30 Minutos',
  [TimeFrame.H1]: '1 Hora',
  [TimeFrame.H4]: '4 Horas',
  [TimeFrame.D1]: '1 Día',
  [TimeFrame.W1]: '1 Semana',
};

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  [SignalType.BUY]: 'Compra',
  [SignalType.SELL]: 'Venta',
  [SignalType.HOLD]: 'Mantener',
};

export const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  [SignalType.BUY]: 'green',
  [SignalType.SELL]: 'red',
  [SignalType.HOLD]: 'gray',
};

export const SIGNAL_TYPE_EMOJIS: Record<SignalType, string> = {
  [SignalType.BUY]: '🟢',
  [SignalType.SELL]: '🔴',
  [SignalType.HOLD]: '🟡',
};

// ==================== UTILITY TYPES ====================

export type ApiResponse<T> = StandardResponse<T> | ErrorResponse;

export type SignalWithMetadata = TradingSignalDto & {
  isActive?: boolean;
  age?: number; // en minutos
  status?: 'pending' | 'executed' | 'expired';
};

export type TradeWithAnalytics = TradeDto & {
  duration?: number;
  pipsGained?: number;
  roi?: number;
};

// ==================== TYPE GUARDS ====================

export function isErrorResponse(response: any): response is ErrorResponse {
  return response.success === false && 'error' in response;
}

export function isStandardResponse<T>(response: any): response is StandardResponse<T> {
  return response.success === true && 'data' in response;
}

export function isBuySignal(signal: TradingSignalDto): boolean {
  return signal.type === SignalType.BUY;
}

export function isSellSignal(signal: TradingSignalDto): boolean {
  return signal.type === SignalType.SELL;
}

export function isHighConfidenceSignal(signal: TradingSignalDto, threshold: number = 70): boolean {
  return signal.confidence >= threshold;
}

// ==================== HELPER FUNCTIONS ====================

export function getSignalColor(type: SignalType): string {
  return SIGNAL_TYPE_COLORS[type];
}

export function getSignalEmoji(type: SignalType): string {
  return SIGNAL_TYPE_EMOJIS[type];
}

export function getSignalLabel(type: SignalType): string {
  return SIGNAL_TYPE_LABELS[type];
}

export function getTimeframeLabel(timeframe: TimeFrame): string {
  return TIMEFRAME_LABELS[timeframe];
}

export function formatConfidence(confidence: number): string {
  return `${confidence.toFixed(0)}%`;
}

export function formatPrice(price: number, decimals: number = 5): string {
  return price.toFixed(decimals);
}

export function calculatePips(entry: number, exit: number, symbol: string): number {
  const pipMultiplier = symbol.includes('JPY') ? 100 : 10000;
  return Math.abs((exit - entry) * pipMultiplier);
}

export function calculateRoi(entryPrice: number, exitPrice: number, type: SignalType): number {
  if (type === SignalType.BUY) {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
}

export function isSymbolSupported(symbol: string): symbol is SupportedSymbol {
  return SUPPORTED_SYMBOLS.includes(symbol as SupportedSymbol);
}

export function getBotIntervalLabel(interval: BotInterval): string {
  const minutes = interval / 60000;
  if (minutes < 60) {
    return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
  }
  const hours = minutes / 60;
  return `${hours} hora${hours > 1 ? 's' : ''}`;
}

export function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function getSignalAge(timestamp: string): number {
  const now = new Date().getTime();
  const signalTime = new Date(timestamp).getTime();
  return Math.floor((now - signalTime) / 60000); // en minutos
}

export function isSignalExpired(timestamp: string, expiryMinutes: number = 60): boolean {
  return getSignalAge(timestamp) > expiryMinutes;
}