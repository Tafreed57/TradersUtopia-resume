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

// Table names
export const TABLE_NAMES = {
  BITCOIN_BULLETS: 'bitcoin_bullets',
  BINANCE_KILLERS: 'binance_killers',
  ALWAYS_WINNING: 'always_winning',
  BINANCE_360: 'binance_360',
  CRYPTO_MUSK: 'crypto_musk',
  TEST: 'test',
} as const;

export const sourceChannelMap: Record<string, string> = {
  crypto1: TABLE_NAMES.BITCOIN_BULLETS,
  crypto2: TABLE_NAMES.BINANCE_KILLERS,
  crypto3: TABLE_NAMES.ALWAYS_WINNING,
  crypto4: TABLE_NAMES.BINANCE_360,
  crypto5: TABLE_NAMES.CRYPTO_MUSK,
};
