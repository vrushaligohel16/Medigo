import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { aiService } from '@/services/aiService';
import type { ChatHistoryItem, ChatMessage } from '@/types/ai';

const QUICK_PROMPTS = [
  'What does Paracetamol do?',
  'Am I taking too many medicines?',
  'Common side effects to watch for?',
  'Should I take medicines with water?',
] as const;

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi — I’m your MediGo health assistant. Ask about medicines, reminders, or general wellness. I’m not a doctor, so always confirm important decisions with a clinician.',
  createdAt: new Date().toISOString(),
};

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAi]}>
      <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.typingText}>typing...</Text>
      </View>
    </View>
  );
}

export default function AiAssistantScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    scrollToEnd();
  }, [messages, isTyping]);

  const sendMessage = async (raw: string) => {
    const content = raw.trim();
    if (!content || isTyping) {
      return;
    }

    setShowPrompts(false);
    setInput('');

    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    // Prior turns only — backend appends the new `message` for the LLM call.
    const history: ChatHistoryItem[] = messages
      .filter((m) => m.id !== 'welcome')
      .map(({ role, content: text }) => ({ role, content: text }));

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const reply = await aiService.chat(content, history);
      const assistantMessage: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: 'assistant',
          content:
            error instanceof Error
              ? error.message
              : 'Sorry — I couldn’t reach the assistant right now. Please try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Health Assistant</Text>
          <Text style={styles.headerSubtitle}>General guidance only</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <Bubble message={item} />}
          contentContainerStyle={styles.listContent}
          style={styles.flex}
          onContentSizeChange={scrollToEnd}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {showPrompts ? (
          <View style={styles.promptsWrap}>
            <Text style={styles.promptsLabel}>Suggested questions</Text>
            <View style={styles.promptsRow}>
              {QUICK_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => void sendMessage(prompt)}
                  disabled={isTyping}
                  style={({ pressed }) => [
                    styles.promptChip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a health question..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={1000}
            editable={!isTyping}
            onSubmitEditing={() => void sendMessage(input)}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={() => void sendMessage(input)}
            disabled={!input.trim() || isTyping}
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              styles.sendBtn,
              (!input.trim() || isTyping) && styles.sendBtnDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isTyping ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.mint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAi: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleAi: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  bubbleTextUser: {
    color: Colors.white,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.mint,
    borderColor: Colors.border,
  },
  typingText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  promptsWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  promptsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  promptsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptChipText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
    color: Colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
});
