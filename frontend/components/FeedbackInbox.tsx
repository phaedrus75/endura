import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from './StyledText';
import type { FeedbackInboxItem } from '../services/api';

interface FeedbackInboxProps {
  items: FeedbackInboxItem[];
  loading: boolean;
  onSelect: (id: number) => void;
  onCompose: () => void;
  loadError?: string | null;
  onRetry?: () => void;
}

export default function FeedbackInbox({ items, loading, onSelect, onCompose, loadError, onRetry }: FeedbackInboxProps) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.composeCta} onPress={onCompose} accessibilityRole="button">
        <Text style={styles.composeCtaText}>＋ Send new feedback</Text>
      </TouchableOpacity>

      {!!loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          {onRetry ? (
            <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#5E7F6E" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {items.map(row => (
            <TouchableOpacity
              key={row.id}
              style={styles.row}
              onPress={() => onSelect(row.id)}
              accessibilityRole="button"
              accessibilityLabel={`Feedback ${row.id}, ${row.unread_count ? 'unread' : 'read'}`}
            >
              <View style={styles.rowTop}>
                <Text style={styles.type}>{row.feedback_type}</Text>
                {row.unread_count > 0 ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {row.title?.trim() || row.message_preview || 'Feedback'}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {row.message_preview}
              </Text>
              {row.has_team_reply ? (
                <Text style={styles.teamHint}>Team replied — tap to read</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 120 },
  composeCta: {
    backgroundColor: '#E1F0E5',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C9D6CC',
  },
  composeCtaText: { fontSize: 15, fontWeight: '700', color: '#2D3B36' },
  centered: { paddingVertical: 24, alignItems: 'center' },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2EAE5',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  type: { fontSize: 11, fontWeight: '700', color: '#7C8A84', textTransform: 'uppercase' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E11D48' },
  title: { fontSize: 16, fontWeight: '700', color: '#2D3B36', marginBottom: 4 },
  preview: { fontSize: 13, color: '#5A6B65', lineHeight: 18 },
  teamHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#5E7F6E',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#991b1b', marginBottom: 8 },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: '#991b1b' },
});
