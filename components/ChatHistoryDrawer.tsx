/**
 * ChatHistoryDrawer
 * Modal drawer listing all saved chat sessions.
 * - Tap to switch session
 * - Long-press to delete
 * - Tap pencil icon to rename
 * - "New Chat" button at bottom
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import {
    type ChatSessionMeta,
    createSession,
    deleteSession,
    listSessions,
    renameSession,
} from '../src/shared/lib/stores/useChatSessionStore';
import { clearChatMessages } from '../src/shared/lib/stores/useDatabaseService';
import { borderRadius, colors, spacing, typography } from '../src/shared/lib/theme';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';

interface Props {
    visible: boolean;
    activeSessionId: string;
    onSelectSession: (session: ChatSessionMeta) => void;
    onNewSession: (session: ChatSessionMeta) => void;
    onClose: () => void;
}

export default function ChatHistoryDrawer({
    visible,
    activeSessionId,
    onSelectSession,
    onNewSession,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const themeMode = useProfileStore((s) => s.themeMode);
    const tc = themeMode === 'dark' ? colors.dark : colors.light;

    const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const reload = async () => {
        const list = await listSessions();
        setSessions(list);
    };

    useEffect(() => {
        if (visible) reload();
    }, [visible]);

    const handleNew = async () => {
        const s = await createSession();
        onNewSession(s);
        onClose();
    };

    const handleSelect = (session: ChatSessionMeta) => {
        if (editingId) return; // don't switch while editing
        onSelectSession(session);
        onClose();
    };

    const handleLongPress = (session: ChatSessionMeta) => {
        Alert.alert(
            t('chatHistory.deleteTitle'),
            t('chatHistory.deleteMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await clearChatMessages(session.id);
                        await deleteSession(session.id);
                        await reload();
                        // If we deleted the active session caller must handle it
                        if (session.id === activeSessionId) {
                            const remaining = await listSessions();
                            if (remaining.length > 0) {
                                onSelectSession(remaining[0]);
                            } else {
                                const fresh = await createSession();
                                onNewSession(fresh);
                            }
                            onClose();
                        }
                    },
                },
            ],
        );
    };

    const startEdit = (session: ChatSessionMeta) => {
        setEditingId(session.id);
        setEditText(session.title);
    };

    const commitEdit = async () => {
        if (!editingId) return;
        await renameSession(editingId, editText);
        setEditingId(null);
        setEditText('');
        await reload();
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
    };

    const renderItem = ({ item }: { item: ChatSessionMeta }) => {
        const isActive = item.id === activeSessionId;
        const isEditing = editingId === item.id;

        return (
            <Pressable
                onPress={() => handleSelect(item)}
                onLongPress={() => handleLongPress(item)}
                style={[
                    styles.row,
                    { borderBottomColor: tc.border },
                    isActive && { backgroundColor: colors.primary[500] + '15' },
                ]}
            >
                <View style={[styles.activeBar, isActive && { backgroundColor: colors.primary[500] }]} />

                <View style={styles.rowContent}>
                    {isEditing ? (
                        <TextInput
                            autoFocus
                            value={editText}
                            onChangeText={setEditText}
                            onBlur={commitEdit}
                            onSubmitEditing={commitEdit}
                            style={[styles.renameInput, { color: tc.text, borderColor: colors.primary[500] }]}
                        />
                    ) : (
                        <Text
                            style={[styles.sessionTitle, { color: isActive ? colors.primary[400] : tc.text }]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                    )}
                    <Text style={[styles.sessionPreview, { color: tc.textMuted }]} numberOfLines={1}>
                        {item.lastMessage || 'No messages yet'}
                    </Text>
                </View>

                <View style={styles.rowMeta}>
                    <Text style={[styles.sessionDate, { color: tc.textMuted }]}>{formatDate(item.lastMessageAt)}</Text>
                    <TouchableOpacity onPress={() => startEdit(item)} hitSlop={8}>
                        <Ionicons name="pencil-outline" size={14} color={tc.textMuted} />
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    return (
        <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
            <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <Animated.View
                    entering={SlideInRight.duration(250)}
                    exiting={SlideOutRight.duration(200)}
                    style={[styles.drawer, { backgroundColor: tc.surface }]}
                >
                    {/* Drawer header */}
                    <View style={[styles.drawerHeader, { borderBottomColor: tc.border }]}>
                        <Text style={[styles.drawerTitle, { color: tc.text }]}>{t('chatHistory.title')}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <Ionicons name="close" size={22} color={tc.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Session list */}
                    <FlatList
                        data={sessions}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        ListEmptyComponent={
                            <Text style={[styles.emptyText, { color: tc.textMuted }]}>{t('chatHistory.newChat')}</Text>
                        }
                        style={styles.list}
                    />

                    {/* New chat button */}
                    <TouchableOpacity
                        onPress={handleNew}
                        style={[styles.newBtn, { borderTopColor: tc.border }]}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary[400]} />
                        <Text style={[styles.newBtnText, { color: colors.primary[400] }]}>{t('chatHistory.newChat')}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    drawer: {
        width: '78%',
        maxWidth: 340,
        flex: 1,
        paddingTop: 56,
    },
    drawerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.base,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
    },
    drawerTitle: {
        fontSize: typography.fontSize.md,
        fontWeight: '700',
    },
    list: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingRight: spacing.base,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    activeBar: {
        width: 3,
        height: '70%',
        borderRadius: 2,
        marginRight: spacing.sm,
        backgroundColor: 'transparent',
    },
    rowContent: {
        flex: 1,
        gap: 2,
    },
    sessionTitle: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
    sessionPreview: {
        fontSize: typography.fontSize.sm,
    },
    rowMeta: {
        alignItems: 'flex-end',
        gap: 4,
        marginLeft: spacing.sm,
    },
    sessionDate: {
        fontSize: typography.fontSize.xs,
    },
    renameInput: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
        borderBottomWidth: 1,
        paddingVertical: 2,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: spacing.xl,
        fontSize: typography.fontSize.sm,
    },
    newBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.base,
        borderTopWidth: 1,
    },
    newBtnText: {
        fontSize: typography.fontSize.base,
        fontWeight: '600',
    },
});
