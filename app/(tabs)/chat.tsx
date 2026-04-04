// TODO(next-build): expo-clipboard paketi eklenecek (native modül gerektirir, yeni EAS build alınmalı).
// Kurulum: `npx expo install expo-clipboard`
// Sonra Share.share() yerine Clipboard.setStringAsync(content) kullanılacak.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    Share,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { v4 as uuidv4 } from 'uuid';
import HybridLLMManager from '../../src/shared/api/llm/HybridLLMManager';
import {
    fetchChatMessages,
    saveChatMessage,
    clearChatMessages,
} from '../../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { borderRadius, colors, spacing, typography } from '../../src/shared/lib/theme';

import ChatHistoryDrawer from '../../components/ChatHistoryDrawer';
import {
    type ChatSessionMeta,
    createSession,
    listSessions,
    updateSessionMeta,
    deleteSession,
} from '../../src/shared/lib/stores/useChatSessionStore';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const LANGUAGE_NAMES: Record<string, string> = {
    tr: 'Turkish',
    en: 'English',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    ar: 'Arabic',
};

export type ChatMode = 'tutor' | 'balanced' | 'chat';

const CHAT_MODE_LABELS: Record<ChatMode, { labelKey: string; icon: string }> = {
    tutor:    { labelKey: 'chat.mode.tutor', icon: '🎓' },
    balanced: { labelKey: 'chat.mode.balanced', icon: '⚖️' },
    chat:     { labelKey: 'chat.mode.chat', icon: '💬' },
};

function buildSystemPrompt(nativeLanguage: string, mode: ChatMode = 'balanced'): string {
    const langName = LANGUAGE_NAMES[nativeLanguage] || nativeLanguage;

    const modeInstructions: Record<ChatMode, string> = {
        tutor: `TEACHING MODE (Tutor-first):
- Actively teach vocabulary: after every user message introduce 1-2 relevant new words with a definition and example.
- Always correct grammar mistakes explicitly and explain why.
- Ask comprehension or practice questions to guide the user.
- Keep replies educational and structured (numbered points are fine).
- Still be warm and encouraging.`,

        balanced: `BALANCED MODE (default):
- Mix natural conversation with light teaching.
- Correct only significant grammar mistakes, briefly and kindly.
- Introduce new vocabulary only when it fits naturally in context.
- Keep replies conversational (3-5 sentences).`,

        chat: `CONVERSATION MODE (Chat-first):
- Act like a friendly native speaker — just have a natural conversation.
- Do NOT correct grammar unless the user asks.
- Do NOT introduce vocabulary lessons unless directly asked.
- Keep replies short, casual, and engaging (1-3 sentences).`,
    };

    return `You are a friendly English learning assistant called AU MoDA 🐴.
You help ${langName}-speaking users learn English.

FORMATTING RULES (strictly follow):
- NEVER use markdown tables (no | characters, no --- separators)
- NEVER use markdown headers (no ## or ###)
- Do NOT use bold (**word**) or italic (*word*) syntax
- Max 5 vocabulary items per message; if the user asks for more, give 5 and offer to continue

${modeInstructions[mode]}

Always be supportive and encouraging.`;
}

/** Remove markdown tables, headers, and bold/italic syntax from LLM output. */
function stripMarkdown(text: string): string {
    return text
        // Remove table separator lines like |---|---|---|
        .split('\n')
        .filter((line) => !/^\s*(\|[-:\s|]+)+\s*$/.test(line))
        .join('\n')
        // Remove table row pipes: | col | col | => col  col
        .replace(/\|/g, ' ')
        // Remove markdown headers: ## Title => Title
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic: **word** => word, *word* => word
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        // Remove code-block fences
        .replace(/```[\s\S]*?```/g, '')
        // Collapse multiple blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export default function ChatScreen() {
    const { t } = useTranslation();
    const themeMode = useProfileStore((s) => s.themeMode);
    const nativeLanguage = useProfileStore((s) => s.nativeLanguage);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [chatMode, setChatMode] = useState<ChatMode>('balanced');
    const [streamingContent, setStreamingContent] = useState('');
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [historyVisible, setHistoryVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Bootstrap: load latest session or create one
    useEffect(() => {
        const init = async () => {
            const sessions = await listSessions();
            if (sessions.length > 0) {
                setActiveSessionId(sessions[0].id);
            } else {
                const s = await createSession();
                setActiveSessionId(s.id);
            }
        };
        init();
    }, []);

    // Load messages whenever the active session changes
    useEffect(() => {
        if (!activeSessionId) return;
        setIsLoaded(false);
        setMessages([]);
        const load = async () => {
            try {
                const dbMessages = await fetchChatMessages(activeSessionId);
                if (dbMessages.length > 0) {
                    setMessages(
                        dbMessages.map((m) => ({
                            id: m.id,
                            role: m.role as 'user' | 'assistant',
                            content: m.content,
                            timestamp: m.createdAt,
                        })),
                    );
                    console.log(`[Chat] Loaded ${dbMessages.length} messages for session ${activeSessionId}`);
                } else {
                    const welcomeMsg: Message = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: t('chat.welcome'),
                        timestamp: new Date(),
                    };
                    setMessages([welcomeMsg]);
                    await saveChatMessage('assistant', welcomeMsg.content, activeSessionId);
                }
            } catch {
                setMessages([{
                    id: uuidv4(),
                    role: 'assistant',
                    content:
                        "Hello! I'm your English learning assistant 🐴 I can help you practice vocabulary, check your grammar, or just have a conversation in English. What would you like to work on today?",
                    timestamp: new Date(),
                }]);
            }
            setIsLoaded(true);
        };
        load();
    }, [activeSessionId]);

const sendMessage = async () => {
        if (!input.trim() || !activeSessionId) return;

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        console.log(`\n--- Chat Update ---\n👤 USER: ${userMessage.content}`);
        setInput('');
        setIsTyping(true);

        // Persist user message + update session metadata (triggers auto-title)
        try {
            await saveChatMessage('user', userMessage.content, activeSessionId);
            await updateSessionMeta(activeSessionId, userMessage.content, 'user');
        } catch (e) {
            console.error('[Chat] Failed to save user message:', e);
        }

        // Get AI response
        try {
            const llm = HybridLLMManager.getInstance();
            const chatHistory = [
                { role: 'system' as const, content: buildSystemPrompt(nativeLanguage, chatMode) },
                ...messages.slice(-10).map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })),
                { role: 'user' as const, content: userMessage.content },
            ];

            const response = await llm.chat(chatHistory);

            const aiMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);
            setStreamingContent('');
            console.log(`🤖 AI: ${aiMessage.content}\n-------------------\n`);

            // Persist AI message + update last message preview
            try {
                await saveChatMessage('assistant', aiMessage.content, activeSessionId);
                await updateSessionMeta(activeSessionId, aiMessage.content, 'assistant');
            } catch (e) {
                console.error('[Chat] Failed to save AI message:', e);
            }
        } catch {
            const errorMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: t('chat.error'),
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        }

        setIsTyping(false);
    };

    /** Delete current session, switch to next available or create new */
    const handleDeleteSession = async () => {
        if (!activeSessionId) return;
        Alert.alert(
            t('chat.deleteSession.title'),
            t('chat.deleteSession.message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearChatMessages(activeSessionId);
                            await deleteSession(activeSessionId);
                            const remaining = await listSessions();
                            if (remaining.length > 0) {
                                setActiveSessionId(remaining[0].id);
                            } else {
                                const s = await createSession();
                                setActiveSessionId(s.id);
                            }
                        } catch (error) {
                            console.error('Failed to delete chat:', error);
                        }
                    },
                },
            ],
        );
    };

    const copyMessage = (content: string) => {
        Alert.alert(
            t('chat.message'),
            undefined,
            [
                {
                    text: t('chat.shareOrCopy'),
                    onPress: () => Share.share({ message: content }),
                },
                { text: t('common.cancel'), style: 'cancel' },
            ],
            { cancelable: true },
        );
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        const displayText = isUser ? item.content : stripMarkdown(item.content);
        return (
            <Animated.View entering={FadeInUp.duration(300)}>
                <Pressable
                    onLongPress={() => copyMessage(item.content)}
                    style={[
                        styles.messageBubble,
                        isUser
                            ? [styles.userBubble, { backgroundColor: colors.primary[500] }]
                            : [styles.aiBubble, { backgroundColor: tc.surfaceElevated }],
                    ]}
                >
                    {!isUser && (
                        <View style={styles.aiAvatar}>
                            <Text style={{ fontSize: 16 }}>🐴</Text>
                        </View>
                    )}
                    <Text
                        selectable
                        style={[
                            styles.messageText,
                            !isUser && styles.aiMessageText,
                            { color: isUser ? '#fff' : tc.text },
                        ]}
                    >
                        {displayText}
                    </Text>
                </Pressable>
            </Animated.View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: tc.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={90}
        >
            {/* Header / Clear button */}
            <View style={[styles.header, { borderBottomColor: tc.border }]}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.headerTitle, { color: tc.text }]}>{t('chat.title')}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={() => setHistoryVisible(true)} style={styles.clearButton}>
                        <Ionicons name="chatbubbles-outline" size={22} color={tc.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteSession} style={styles.clearButton}>
                        <Ionicons name="trash-outline" size={22} color={tc.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Sub-header for Mode Pills to prevent horizontal overflow on narrow screens */}
            <View style={[styles.subHeader, { borderBottomColor: tc.border }]}>
                <View style={[styles.modePills, { backgroundColor: tc.surfaceElevated }]}>
                    {(Object.keys(CHAT_MODE_LABELS) as ChatMode[]).map((m) => (
                        <TouchableOpacity
                            key={m}
                            onPress={() => setChatMode(m)}
                            style={[
                                styles.modePill,
                                chatMode === m && { backgroundColor: colors.primary[500] },
                            ]}
                        >
                            <Text style={styles.modePillIcon}>{CHAT_MODE_LABELS[m].icon}</Text>
                            <Text style={[
                                styles.modePillText,
                                { color: chatMode === m ? '#fff' : tc.textMuted },
                            ]}>
                                {t(CHAT_MODE_LABELS[m].labelKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                ListFooterComponent={
                    <>
                        {streamingContent ? (
                            <View
                                style={[
                                    styles.messageBubble,
                                    styles.aiBubble,
                                    { backgroundColor: tc.surfaceElevated },
                                ]}
                            >
                                <View style={styles.aiAvatar}>
                                    <Text style={{ fontSize: 16 }}>🐴</Text>
                                </View>
                                <Text style={[styles.messageText, styles.aiMessageText, { color: tc.text }]}>
                                    {stripMarkdown(streamingContent)}
                                </Text>
                            </View>
                        ) : null}
                        {isTyping && !streamingContent ? (
                            <Animated.View
                                entering={FadeInDown.duration(200)}
                                style={[styles.typingIndicator, { backgroundColor: tc.surfaceElevated }]}
                            >
                                <View style={styles.aiAvatar}>
                                    <Text style={{ fontSize: 16 }}>🐴</Text>
                                </View>
                                <Text style={[styles.typingText, { color: tc.textMuted }]}>
                                    {t('chat.thinking')}
                                </Text>
                            </Animated.View>
                        ) : null}
                    </>
                }
            />

            {/* Input bar */}
            <View style={[styles.inputContainer, { backgroundColor: tc.surface, borderTopColor: tc.border }]}>
                <TextInput
                    style={[styles.input, { backgroundColor: tc.surfaceElevated, color: tc.text }]}
                    placeholder={t('chat.placeholder')}
                    placeholderTextColor={tc.textMuted}
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={1000}
                    onSubmitEditing={sendMessage}
                />
                <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: input.trim() ? colors.primary[500] : tc.surfaceElevated }]}
                    onPress={sendMessage}
                    disabled={!input.trim() || isTyping}
                >
                    <Ionicons
                        name="send"
                        size={20}
                        color={input.trim() ? '#fff' : tc.textMuted}
                    />
                </TouchableOpacity>
            </View>
            <ChatHistoryDrawer
                visible={historyVisible}
                activeSessionId={activeSessionId ?? ''}
                onSelectSession={(s) => setActiveSessionId(s.id)}
                onNewSession={(s) => setActiveSessionId(s.id)}
                onClose={() => setHistoryVisible(false)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    modePills: {
        flexDirection: 'row',
        borderRadius: borderRadius.xl,
        padding: 2,
        gap: 1,
    },
    modePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.xl,
        gap: 3,
    },
    modePillIcon: {
        fontSize: 11,
    },
    modePillText: {
        fontSize: 11,
        fontWeight: '600',
    },
    subHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    headerLeft: {
        flexDirection: 'column',
    },
    headerTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    clearButton: {
        padding: spacing.xs,
    },
    messageList: {
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        paddingBottom: spacing.lg,
    },
    messageBubble: {
        maxWidth: '93%',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: borderRadius.sm,
    },
    aiBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: borderRadius.sm,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    aiAvatar: {
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    messageText: {
        fontSize: typography.fontSize.base,
        lineHeight: 22,
        flexShrink: 1,
    },
    aiMessageText: {
        flex: 1,
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.sm,
    },
    typingText: {
        fontSize: typography.fontSize.sm,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        minHeight: 42,
        maxHeight: 100,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.xl,
        fontSize: typography.fontSize.base,
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
