export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type ChatResponse = {
  reply: string;
};
