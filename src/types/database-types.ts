// Database table interfaces
export interface BaseMessage {
  id: number;
  msg_id: string;
  content: string | null;
  attachments: any;
  reference_msg: any;
  image_url: any;
  timestamp: Date | null;
  relayed: number;
  created_at: Date;
}

// export interface BitcoinBulletsMessage extends BaseMessage {}
// export interface BinanceKillersMessage extends BaseMessage {}
// export interface AlwaysWinningMessage extends BaseMessage {}
// export interface RussianInsidersMessage extends BaseMessage {}
// export interface Binance360Message extends BaseMessage {}
// export interface CryptoMuskMessage extends BaseMessage {}
// export interface TestMessage extends BaseMessage {}

// // Input types for creating messages (excluding auto-generated fields)
// export interface CreateMessageInput {
//   msg_id: string;
//   content?: string | null;
//   attachments?: any;
//   reference_msg?: any;
//   image_url?: any;
//   timestamp?: Date | null;
//   relayed?: number;
// }

// Table names
export const TABLE_NAMES = {
  BITCOIN_BULLETS: 'bitcoin_bullets',
  BINANCE_KILLERS: 'binance_killers',
  ALWAYS_WINNING: 'always_winning',
  RUSSIAN_INSIDERS: 'russian_insiders',
  BINANCE_360: 'binance_360',
  CRYPTO_MUSK: 'crypto_musk',
  TEST: 'test',
} as const;

export const sourceChannelMap: Record<string, string> = {
  crypto1: TABLE_NAMES.BITCOIN_BULLETS,
  crypto2: TABLE_NAMES.BINANCE_KILLERS,
  crypto3: TABLE_NAMES.ALWAYS_WINNING,
  dailyBTCUpdate: TABLE_NAMES.RUSSIAN_INSIDERS,
  crypto5: TABLE_NAMES.BINANCE_360,
  crypto6: TABLE_NAMES.CRYPTO_MUSK,
};
