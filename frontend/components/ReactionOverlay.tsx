import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, AppState,
} from 'react-native';
import { Text } from './StyledText';
import { LinearGradient } from 'expo-linear-gradient';
import { feedAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, shadows, borderRadius } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REACTIONS = [
  { key: 'nice', label: 'Nice!', emoji: '👏' },
  { key: 'fire', label: 'Fire!', emoji: '🔥' },
  { key: 'heart', label: 'Love!', emoji: '❤️' },
];

const REACTION_MESSAGES: Record<string, string[]> = {
  nice: ['thinks you did great!', 'is cheering you on!', 'clapped for you!'],
  fire: ['thinks you\'re on fire!', 'is impressed!', 'says you\'re crushing it!'],
  heart: ['sent you love!', 'loves what you did!', 'is sending good vibes!'],
};

interface IncomingReaction {
  id: number;
  sender_username: string;
  reaction: string;
  event_description: string;
  created_at: string;
}

const POLL_INTERVAL = 10_000;

export default function ReactionOverlay() {
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reactions, setReactions] = useState<IncomingReaction[]>([]);
  const emojiFloat = useRef(new Animated.Value(0)).current;
  const msgIdx = useRef(0);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const show = useCallback((data: IncomingReaction[]) => {
    msgIdx.current = Math.floor(Math.random() * 3);
    setReactions(data);
    setVisible(true);
    emojiFloat.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(emojiFloat, { toValue: -8, duration: 1200, useNativeDriver: true }),
        Animated.timing(emojiFloat, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [emojiFloat]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setReactions([]);
  }, []);

  const check = useCallback(async () => {
    try {
      const data = await feedAPI.getNewReactions();
      if (data && data.length > 0) show(data);
    } catch {}
  }, [show]);

  useEffect(() => {
    if (!isAuthenticated) return;

    check();
    polling.current = setInterval(check, POLL_INTERVAL);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      if (polling.current) clearInterval(polling.current);
      sub.remove();
    };
  }, [isAuthenticated, check]);

  if (!visible || reactions.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade">
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={dismiss}>
        <View style={s.card}>
          <LinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.gradient}
          >
            <TouchableOpacity
              style={s.close}
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>

            {reactions.length === 1 ? (
              <>
                <Animated.Text style={[s.bigEmoji, { transform: [{ translateY: emojiFloat }] }]}>
                  {REACTIONS.find(r => r.key === reactions[0].reaction)?.emoji || '💫'}
                </Animated.Text>
                <Text style={s.sender}>{reactions[0].sender_username}</Text>
                <Text style={s.message}>
                  {REACTION_MESSAGES[reactions[0].reaction]?.[
                    msgIdx.current % (REACTION_MESSAGES[reactions[0].reaction]?.length || 1)
                  ] || 'reacted to your activity!'}
                </Text>
                <Text style={s.context} numberOfLines={2}>
                  "{reactions[0].event_description}"
                </Text>
              </>
            ) : (
              <>
                <Animated.View style={[s.emojiRow, { transform: [{ translateY: emojiFloat }] }]}>
                  {[...new Set(reactions.map(r => r.reaction))].map((rKey) => (
                    <Text key={rKey} style={s.bigEmoji}>
                      {REACTIONS.find(r => r.key === rKey)?.emoji || '💫'}
                    </Text>
                  ))}
                </Animated.View>
                <Text style={s.sender}>{reactions.length} new reactions!</Text>
                <View style={s.list}>
                  {reactions.slice(0, 4).map((r) => (
                    <View key={r.id} style={s.listItem}>
                      <Text style={s.listEmoji}>
                        {REACTIONS.find(rx => rx.key === r.reaction)?.emoji || '💫'}
                      </Text>
                      <Text style={s.listText} numberOfLines={1}>
                        <Text style={{ fontWeight: '700' }}>{r.sender_username}</Text>
                        {' '}{REACTION_MESSAGES[r.reaction]?.[0] || 'reacted!'}
                      </Text>
                    </View>
                  ))}
                  {reactions.length > 4 && (
                    <Text style={s.moreText}>+{reactions.length - 4} more</Text>
                  )}
                </View>
              </>
            )}
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    ...shadows.large,
  },
  gradient: {
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeText: { fontSize: 14, fontWeight: '700', color: '#666' },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  emojiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sender: {
    fontSize: 20, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center', marginBottom: 4,
  },
  message: {
    fontSize: 16, fontWeight: '500', color: colors.textSecondary,
    textAlign: 'center', marginBottom: 10,
  },
  context: {
    fontSize: 13, fontStyle: 'italic', color: colors.textMuted,
    textAlign: 'center', marginBottom: 6, paddingHorizontal: 10,
  },
  list: { width: '100%', marginTop: 8, marginBottom: 4 },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  listEmoji: { fontSize: 22 },
  listText: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  moreText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
