export interface DiscordMessage {
  id: string;
  content?: string;
  attachments?: DiscordAttachment[];
  referenced_message?: any;
  timestamp?: string;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  content_type?: string;
  size: number;
}

export interface AppConfig {
  source_channels: Record<string, string>;
  string_filters: string[];
  polling_interval: number;
  message_batch_size: number;
  channel_rules?: Record<string, { content_filter?: string }>;
}

export interface StoredMessage {
  msgId: string;
  channelName: string;
  content: string | null;
  attachments: any;
  referenceMsg: any;
  imageUrl: string[] | null;
  timestamp: Date | null;
  relayed: number;
}
