import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
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

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const SESSION_ID = 'main_chat';

const LANGUAGE_NAMES: Record<string, string> = {
    tr: 'Turkish',
    en: 'English',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    ar: 'Arabic',
};

function buildSystemPrompt(nativeLanguage: string): string {
    const langName = LANGUAGE_NAMES[nativeLanguage] || nativeLanguage;
    return `You are a friendly English learning assistant called LinguaLearn Owl 🦉.
You help ${langName}-speaking users learn English. Your role:
- Have natural conversations in English to help users practice
- Teach vocabulary contextually
- Gently correct grammar mistakes with encouraging feedback
- Adjust complexity to the user's level
- Use emojis occasionally to keep things fun
Always be supportive and encouraging.`;
}

export default function ChatScreen() {
    const themeMode = useProfileStore((s) => s.themeMode);
    const nativeLanguage = useProfileStore((s) => s.nativeLanguage);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [turboMode, setTurboMode] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const flatListRef = useRef<FlatList>(null);

    // Load previous messages
    useEffect(() => {
        const load = async () => {
            try {
                const dbMessages = await fetchChatMessages(SESSION_ID);
                if (dbMessages.length > 0) {
                    setMessages(
                        dbMessages.map((m) => ({
                            id: m.id,
                            role: m.role as 'user' | 'assistant',
                            content: m.content,
                            timestamp: m.createdAt,
                        })),
                    );
                    console.log(`[Chat] Loaded ${dbMessages.length} messages from history.`);
                } else {
                    // Add welcome message
                    const welcomeMsg: Message = {
                        id: uuidv4(),
                        role: 'assistant',
                        content:
                            "Hello! I'm your English learning assistant 🦉 I can help you practice vocabulary, check your grammar, or just have a conversation in English. What would you like to work on today?",
                        timestamp: new Date(),
                    };
                    setMessages([welcomeMsg]);
                    await saveChatMessage('assistant', welcomeMsg.content, SESSION_ID);
                }
            } catch {
                // Fallback welcome message if DB not available
                setMessages([
                    {
                        id: uuidv4(),
                        role: 'assistant',
                        content:
                            "Hello! I'm your English learning assistant 🦉 I can help you practice vocabulary, check your grammar, or just have a conversation in English. What would you like to work on today?",
                        timestamp: new Date(),
                    },
                ]);
            }
            setIsLoaded(true);
        };
        load();
    }, []);

    // Initialize LLM Manager
    useEffect(() => {
        const llm = HybridLLMManager.getInstance();
        if (!llm.getStatus().localReady) {
            llm.initLocalModel().catch(console.warn);
        }
    }, []);

    const sendMessage = async () => {
        if (!input.trim()) return;

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

        // Persist user message
        try {
            await saveChatMessage('user', userMessage.content, SESSION_ID);
        } catch (e) {
            console.error('[Chat] Failed to save user message:', e);
        }

        // Get AI response
        try {
            const llm = HybridLLMManager.getInstance();
            const chatHistory = [
                { role: 'system' as const, content: buildSystemPrompt(nativeLanguage) },
                ...messages.slice(-10).map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                })),
                { role: 'user' as const, content: userMessage.content },
            ];

            let fullResponse = '';
            const onToken = (token: string) => {
                fullResponse += token;
                setStreamingContent(fullResponse);
            };

            const response = await llm.chatLocal(chatHistory, onToken, turboMode);

            const aiMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);
            setStreamingContent('');
            console.log(`🤖 AI: ${aiMessage.content}\n-------------------\n`);

            // Persist AI message
            try {
                await saveChatMessage('assistant', aiMessage.content, SESSION_ID);
            } catch (e) {
                console.error('[Chat] Failed to save AI message:', e);
            }
        } catch {
            const errorMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: "Sorry, I couldn't process that right now. Please try again! 🦉",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        }

        setIsTyping(false);
    };

    const handleClearChat = async () => {
        try {
            await clearChatMessages(SESSION_ID);
            const welcomeMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: "Hello! I'm your English learning assistant 🦉 I can help you practice vocabulary, check your grammar, or just have a conversation in English. What would you like to work on today?",
                timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
            console.log("[Chat] History cleared.");
            // Re-save welcome message after clearing
            await saveChatMessage('assistant', welcomeMsg.content, SESSION_ID);
        } catch (error) {
            console.error("Failed to clear chat:", error);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <Animated.View
                entering={FadeInUp.duration(300)}
                style={[
                    styles.messageBubble,
                    isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary[500] }]
                        : [styles.aiBubble, { backgroundColor: tc.surfaceElevated }],
                ]}
            >
                {!isUser && (
                    <View style={styles.aiAvatar}>
                        <Text style={{ fontSize: 16 }}>🦉</Text>
                    </View>
                )}
                <Text
                    style={[
                        styles.messageText,
                        !isUser && styles.aiMessageText,
                        { color: isUser ? '#fff' : tc.text },
                    ]}
                >
                    {item.content}
                </Text>
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
                    <Text style={[styles.headerTitle, { color: tc.text }]}>Learning Assistant</Text>
                    <View style={[styles.hwBadge, { backgroundColor: colors.success.main + '20' }]}>
                        <Ionicons name="flash" size={10} color={colors.success.main} />
                        <Text style={[styles.hwBadgeText, { color: colors.success.main }]}>GPU Accelerated</Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity 
                        onPress={() => setTurboMode(!turboMode)} 
                        style={[
                            styles.turboBtn, 
                            turboMode && { backgroundColor: colors.primary[500] + '20', borderColor: colors.primary[500] }
                        ]}
                    >
                        <Ionicons name="rocket" size={18} color={turboMode ? colors.primary[500] : tc.textMuted} />
                        <Text style={[styles.turboText, { color: turboMode ? colors.primary[500] : tc.textMuted }]}>TURBO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearChat} style={styles.clearButton}>
                        <Ionicons name="trash-outline" size={22} color={tc.textMuted} />
                    </TouchableOpacity>
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
                                    <Text style={{ fontSize: 16 }}>🦉</Text>
                                </View>
                                <Text style={[styles.messageText, styles.aiMessageText, { color: tc.text }]}>
                                    {streamingContent}
                                </Text>
                            </View>
                        ) : null}
                        {isTyping && !streamingContent ? (
                            <Animated.View
                                entering={FadeInDown.duration(200)}
                                style={[styles.typingIndicator, { backgroundColor: tc.surfaceElevated }]}
                            >
                                <View style={styles.aiAvatar}>
                                    <Text style={{ fontSize: 16 }}>🦉</Text>
                                </View>
                                <Text style={[styles.typingText, { color: tc.textMuted }]}>
                                    Thinking...
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
                    placeholder="Type a message..."
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
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    hwBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 2,
        gap: 2,
    },
    hwBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    turboBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'transparent',
        gap: 4,
    },
    turboText: {
        fontSize: 10,
        fontWeight: '800',
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
        maxWidth: '82%',
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
        borderRadius: 14,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
        marginTop: 2,
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
