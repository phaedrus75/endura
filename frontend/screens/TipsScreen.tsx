import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { tipsAPI, StudyTip } from '../services/api';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.6;

const categoryEmojis: Record<string, string> = {
  focus: '🎯',
  memorization: '🧠',
  motivation: '💪',
  general: '📚',
};

const categoryColors: Record<string, string> = {
  focus: colors.primary,
  memorization: colors.epic,
  motivation: colors.coral,
  general: colors.rare,
};

export default function TipsScreen() {
  const [tips, setTips] = useState<StudyTip[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTipContent, setNewTipContent] = useState('');
  const [newTipCategory, setNewTipCategory] = useState('general');
  const flatListRef = useRef<FlatList>(null);

  const loadTips = async () => {
    try {
      const tipsData = await tipsAPI.getTips(20);
      setTips(tipsData);
    } catch (error) {
      console.error('Failed to load tips:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTips();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadTips();
    setIsRefreshing(false);
  };

  const handleLike = async (tip: StudyTip) => {
    try {
      await tipsAPI.markViewed(tip.id, !tip.user_liked);
      setTips((prev) =>
        prev.map((t) =>
          t.id === tip.id
            ? {
                ...t,
                user_liked: !t.user_liked,
                likes_count: t.user_liked ? t.likes_count - 1 : t.likes_count + 1,
              }
            : t
        )
      );
    } catch (error) {
      console.error('Failed to like tip:', error);
    }
  };

  const handleCreateTip = async () => {
    if (!newTipContent.trim()) {
      Alert.alert('Error', 'Please enter a tip');
      return;
    }

    try {
      await tipsAPI.createTip(newTipContent.trim(), newTipCategory);
      setNewTipContent('');
      setShowCreateModal(false);
      await loadTips();
      Alert.alert('Success', 'Your study tip has been shared!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderTip = ({ item, index }: { item: StudyTip; index: number }) => {
    const categoryColor = categoryColors[item.category] || colors.rare;
    const categoryEmoji = categoryEmojis[item.category] || '📚';

    return (
      <View style={styles.tipCard}>
        <View style={[styles.tipCardInner, { borderColor: categoryColor }]}>
          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
            <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
            <Text style={styles.categoryText}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Text>
          </View>

          {/* Tip Content */}
          <Text style={styles.tipContent}>{item.content}</Text>

          {/* Actions */}
          <View style={styles.tipActions}>
            <TouchableOpacity
              style={[styles.likeButton, item.user_liked && styles.likeButtonActive]}
              onPress={() => handleLike(item)}
            >
              <Text style={styles.likeEmoji}>{item.user_liked ? '❤️' : '🤍'}</Text>
              <Text
                style={[
                  styles.likeCount,
                  item.user_liked && styles.likeCountActive,
                ]}
              >
                {item.likes_count}
              </Text>
            </TouchableOpacity>

            <Text style={styles.tipNumber}>
              {index + 1} / {tips.length}
            </Text>
          </View>
        </View>

        {/* Swipe hint */}
        <Text style={styles.swipeHint}>Swipe up for more tips ↑</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Study Tips</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Post a Tip</Text>
        </TouchableOpacity>
      </View>

      {/* Tips Feed */}
      <FlatList
        ref={flatListRef}
        data={tips}
        renderItem={renderTip}
        keyExtractor={(item) => item.id.toString()}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT + 24}
        decelerationRate="fast"
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💡</Text>
            <Text style={styles.emptyText}>Loading study tips...</Text>
          </View>
        }
      />

      {/* Create Tip Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share a Study Tip ✨</Text>

            <TextInput
              style={styles.tipInput}
              placeholder="Write your study tip here..."
              placeholderTextColor={colors.textMuted}
              value={newTipContent}
              onChangeText={setNewTipContent}
              multiline
              maxLength={300}
            />

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryOptions}>
              {Object.entries(categoryEmojis).map(([cat, emoji]) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    newTipCategory === cat && styles.categoryOptionActive,
                    { borderColor: categoryColors[cat] },
                  ]}
                  onPress={() => setNewTipCategory(cat)}
                >
                  <Text style={styles.categoryOptionEmoji}>{emoji}</Text>
                  <Text style={styles.categoryOptionText}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleCreateTip}>
              <Text style={styles.submitButtonText}>Share Tip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.small,
  },
  createButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  tipCard: {
    height: CARD_HEIGHT + 24,
    paddingVertical: 12,
  },
  tipCardInner: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    justifyContent: 'center',
    ...shadows.medium,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  tipContent: {
    fontSize: 22,
    color: colors.textPrimary,
    lineHeight: 34,
    flex: 1,
  },
  tipActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
  },
  likeButtonActive: {
    backgroundColor: colors.coral + '20',
  },
  likeEmoji: {
    fontSize: 20,
    marginRight: spacing.xs,
  },
  likeCount: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  likeCountActive: {
    color: colors.coral,
  },
  tipNumber: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  swipeHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  emptyCard: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  tipInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  categoryOptionActive: {
    backgroundColor: colors.primaryLight + '30',
  },
  categoryOptionEmoji: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  categoryOptionText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.small,
  },
  submitButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 18,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
