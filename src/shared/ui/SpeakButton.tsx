/**
 * SpeakButton — Text-to-speech pronunciation button.
 *
 * Wraps expo-speech (device TTS). Renders nothing when the target language
 * has no voice installed on the device, so the button only appears for
 * languages the device can actually pronounce. Tap to speak, tap again to stop.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { toBcp47 } from '../lib/languageConfig';
import { colors } from '../lib/theme';

type Size = 'sm' | 'md' | 'lg';

interface SpeakButtonProps {
    /** The text to read aloud. */
    text: string;
    /** Language code — internal ('de') or BCP-47 ('de-DE'). */
    lang: string;
    size?: Size;
    color?: string;
    style?: StyleProp<ViewStyle>;
}

const BTN_SIZE: Record<Size, number> = { sm: 34, md: 40, lg: 48 };
const ICON_SIZE: Record<Size, number> = { sm: 16, md: 20, lg: 24 };

// Device voice list is fetched once and shared across every instance.
let voicesPromise: Promise<Speech.Voice[]> | null = null;
function loadVoices(): Promise<Speech.Voice[]> {
    if (!voicesPromise) {
        voicesPromise = Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
    }
    return voicesPromise;
}

export function SpeakButton({ text, lang, size = 'sm', color, style }: SpeakButtonProps) {
    const [supported, setSupported] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const scale = useSharedValue(1);

    const tint = color ?? colors.primary[400];
    const base = lang.split('-')[0].toLowerCase();

    // Check device voice support once per language.
    useEffect(() => {
        let alive = true;
        loadVoices().then((voices) => {
            if (!alive) return;
            // Fail-open if the device returned no list at all (rare API quirk).
            const ok =
                voices.length === 0 ||
                voices.some((v) => v.language?.toLowerCase().startsWith(base));
            setSupported(ok);
        });
        return () => {
            alive = false;
        };
    }, [base]);

    // Stop any ongoing speech when the text changes or the button unmounts.
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, [text]);

    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    function stopPulse() {
        cancelAnimation(scale);
        scale.value = withTiming(1, { duration: 150 });
    }

    function handlePress() {
        if (speaking) {
            Speech.stop();
            setSpeaking(false);
            stopPulse();
            return;
        }
        setSpeaking(true);
        scale.value = withRepeat(withTiming(1.18, { duration: 480 }), -1, true);
        Speech.speak(text, {
            language: toBcp47(lang),
            onDone: () => {
                setSpeaking(false);
                stopPulse();
            },
            onStopped: () => {
                setSpeaking(false);
                stopPulse();
            },
            onError: () => {
                setSpeaking(false);
                stopPulse();
            },
        });
    }

    if (!supported || !text?.trim()) return null;

    const dim = BTN_SIZE[size];

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Seslendir"
            style={[
                st.btn,
                {
                    width: dim,
                    height: dim,
                    borderRadius: dim / 2,
                    backgroundColor: `${tint}18`,
                    borderColor: `${tint}40`,
                },
                style,
            ]}
        >
            <Animated.View style={pulseStyle}>
                <Ionicons
                    name={speaking ? 'stop' : 'volume-high'}
                    size={ICON_SIZE[size]}
                    color={tint}
                />
            </Animated.View>
        </TouchableOpacity>
    );
}

const st = StyleSheet.create({
    btn: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
});
