import React from 'react';
import { View, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Text } from './StyledText';
import type { FeedbackThreadPayload } from '../services/api';

interface FeedbackThreadProps {
  data: FeedbackThreadPayload | null;
  loading: boolean;
}

export default function FeedbackThread({ data, loading }: FeedbackThreadProps) {
  const fb = data?.feedback;

  return (
    <View style={styles.wrap}>
      {loading || !fb ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#5E7F6E" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.bubble, styles.userBubble]}>
            <Text style={styles.bubbleMeta}>You · original</Text>
            <Text style={styles.bubbleBody}>{fb.message}</Text>
          </View>

          {(fb.attachment_urls || []).length > 0 ? (
            <View style={styles.attRow}>
              {fb.attachment_urls.map((u, i) => (
                <Image key={`${u}-${i}`} source={{ uri: u }} style={styles.attImg} />
              ))}
            </View>
          ) : null}

          {(data?.messages || []).map(m =>
            m.sender === 'admin' ? (
              <View key={m.id} style={[styles.bubble, styles.adminBubble]}>
                <Text style={styles.bubbleMetaAdmin}>Endura team</Text>
                <Text style={styles.bubbleBody}>{m.body}</Text>
              </View>
            ) : null
          )}

          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Replies from the team appear here. Two-way chat is coming soon — for now, use Send new feedback if you need to add more.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 160 },
  centered: { paddingVertical: 32, alignItems: 'center' },
  bubble: { borderRadius: 14, padding: 12, marginBottom: 10 },
  userBubble: { backgroundColor: '#E1F0E5', borderWidth: 1, borderColor: '#C9D6CC', marginLeft: 12 },
  adminBubble: { backgroundColor: '#F2F6F3', borderWidth: 1, borderColor: '#E2EAE5', marginRight: 12 },
  bubbleMeta: { fontSize: 11, fontWeight: '700', color: '#166534', marginBottom: 6 },
  bubbleMetaAdmin: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 6 },
  bubbleBody: { fontSize: 15, color: '#2D3B36', lineHeight: 22 },
  attRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginLeft: 12 },
  attImg: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#EEF3EF' },
  hintBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAF9',
    borderWidth: 1,
    borderColor: '#E2EAE5',
  },
  hintText: { fontSize: 12, color: '#7C8A84', lineHeight: 17 },
});
