import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { shopAPI, statsAPI, UserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

type ShopCategory = 'habitats' | 'paths' | 'accessories' | 'decorations';

interface ShopItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  category: ShopCategory;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  sanctuaryKey: string;
}

const SHOP_ITEMS: ShopItem[] = [
  // Habitats
  { id: 'hab_pond', name: 'Peaceful Pond', emoji: '🏊', description: 'A serene pond for your water-loving friends', price: 50, category: 'habitats', rarity: 'common', sanctuaryKey: 'pond' },
  { id: 'hab_cave', name: 'Cozy Cave', emoji: '🕳️', description: 'A warm shelter for shy animals', price: 75, category: 'habitats', rarity: 'common', sanctuaryKey: 'cave' },
  { id: 'hab_treehouse', name: 'Treehouse', emoji: '🌳', description: 'An elevated home among the canopy', price: 120, category: 'habitats', rarity: 'rare', sanctuaryKey: 'treehouse' },
  { id: 'hab_bamboo', name: 'Bamboo Grove', emoji: '🎋', description: 'A peaceful bamboo forest corner', price: 100, category: 'habitats', rarity: 'rare', sanctuaryKey: 'bamboo' },
  { id: 'hab_waterfall', name: 'Waterfall', emoji: '🏞️', description: 'A majestic cascading waterfall', price: 200, category: 'habitats', rarity: 'epic', sanctuaryKey: 'waterfall' },
  { id: 'hab_volcano', name: 'Warm Springs', emoji: '♨️', description: 'Naturally heated hot springs', price: 300, category: 'habitats', rarity: 'legendary', sanctuaryKey: 'springs' },

  // Paths
  { id: 'path_stone', name: 'Stone Path', emoji: '🪨', description: 'A charming cobblestone walkway', price: 30, category: 'paths', rarity: 'common', sanctuaryKey: 'stone_path' },
  { id: 'path_flower', name: 'Flower Trail', emoji: '🌺', description: 'A path lined with wildflowers', price: 60, category: 'paths', rarity: 'rare', sanctuaryKey: 'flower_path' },
  { id: 'path_bridge', name: 'Wooden Bridge', emoji: '🌉', description: 'A cute bridge over your pond', price: 80, category: 'paths', rarity: 'rare', sanctuaryKey: 'bridge' },
  { id: 'path_lanterns', name: 'Lantern Lane', emoji: '🏮', description: 'Softly glowing paper lanterns', price: 150, category: 'paths', rarity: 'epic', sanctuaryKey: 'lanterns' },

  // Accessories
  { id: 'acc_hat', name: 'Tiny Top Hat', emoji: '🎩', description: 'A dapper hat for your favourite animal', price: 40, category: 'accessories', rarity: 'common', sanctuaryKey: 'hat' },
  { id: 'acc_scarf', name: 'Cozy Scarf', emoji: '🧣', description: 'A warm knitted scarf', price: 35, category: 'accessories', rarity: 'common', sanctuaryKey: 'scarf' },
  { id: 'acc_bow', name: 'Flower Crown', emoji: '💐', description: 'A beautiful crown of wildflowers', price: 55, category: 'accessories', rarity: 'rare', sanctuaryKey: 'crown' },
  { id: 'acc_glasses', name: 'Reading Glasses', emoji: '👓', description: 'Studious specs for smart animals', price: 45, category: 'accessories', rarity: 'common', sanctuaryKey: 'glasses' },
  { id: 'acc_cape', name: 'Hero Cape', emoji: '🦸', description: 'A tiny cape for brave creatures', price: 100, category: 'accessories', rarity: 'epic', sanctuaryKey: 'cape' },
  { id: 'acc_wings', name: 'Fairy Wings', emoji: '🧚', description: 'Sparkly gossamer wings', price: 200, category: 'accessories', rarity: 'legendary', sanctuaryKey: 'wings' },

  // Decorations
  { id: 'dec_flowers', name: 'Flower Bed', emoji: '🌷', description: 'A colourful patch of flowers', price: 25, category: 'decorations', rarity: 'common', sanctuaryKey: 'flowers' },
  { id: 'dec_mushrooms', name: 'Mushroom Ring', emoji: '🍄', description: 'A fairy ring of mushrooms', price: 40, category: 'decorations', rarity: 'common', sanctuaryKey: 'mushrooms' },
  { id: 'dec_rainbow', name: 'Rainbow Arch', emoji: '🌈', description: 'A beautiful rainbow over your sanctuary', price: 150, category: 'decorations', rarity: 'epic', sanctuaryKey: 'rainbow' },
  { id: 'dec_fireflies', name: 'Firefly Jar', emoji: '✨', description: 'Twinkling lights at dusk', price: 80, category: 'decorations', rarity: 'rare', sanctuaryKey: 'fireflies' },
  { id: 'dec_swing', name: 'Tree Swing', emoji: '🪢', description: 'A gentle rope swing on a branch', price: 60, category: 'decorations', rarity: 'rare', sanctuaryKey: 'swing' },
  { id: 'dec_stars', name: 'Starry Sky', emoji: '🌙', description: 'A permanent twilight with twinkling stars', price: 250, category: 'decorations', rarity: 'legendary', sanctuaryKey: 'stars' },
];

const CATEGORY_INFO: Record<ShopCategory, { label: string; emoji: string; color: string }> = {
  habitats: { label: 'Habitats', emoji: '🏡', color: '#7CB87F' },
  paths: { label: 'Paths', emoji: '🛤️', color: '#E8B86D' },
  accessories: { label: 'Accessories', emoji: '🎀', color: '#B794D4' },
  decorations: { label: 'Decorations', emoji: '✨', color: '#7EC8E3' },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#8FBF9F',
  rare: '#7EC8E3',
  epic: '#B794D4',
  legendary: '#E8B86D',
};

const STORAGE_KEY = 'endura_purchased_items';

export default function ShopScreen() {
  const navigation = useNavigation<any>();
  const { refreshUser, user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('habitats');
  const [purchasedIds, setPurchasedIds] = useState<Record<string, boolean>>({});
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadData = async () => {
    try {
      const [statsData, storedPurchases] = await Promise.all([
        statsAPI.getStats(),
        AsyncStorage.getItem(STORAGE_KEY),
      ]);
      setStats(statsData);
      if (storedPurchases) setPurchasedIds(JSON.parse(storedPurchases));
    } catch (e) {
      console.error('Failed to load shop data:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const purchaseItem = async (item: ShopItem) => {
    const coins = stats?.current_coins || 0;
    if (coins < item.price) {
      Alert.alert('Not Enough Eco-Credits', `You need ${item.price - coins} more eco-credits. Keep studying to earn more!`);
      return;
    }
    if (purchasedIds[item.id]) {
      Alert.alert('Already Owned', 'You already have this item in your sanctuary!');
      return;
    }

    try {
      await shopAPI.spendCoins(item.price);
    } catch (e: any) {
      Alert.alert('Purchase Failed', e.message || 'Something went wrong. Please try again.');
      return;
    }

    try {
      const updated = { ...purchasedIds, [item.id]: true };
      setPurchasedIds(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await refreshUser();
      const newStats = await statsAPI.getStats();
      setStats(newStats);
      setShowPreview(false);
      setSelectedItem(null);
      Alert.alert(
        `${item.emoji} Purchased!`,
        `${item.name} has been added to your sanctuary! Visit your Collection to see it.`
      );
    } catch (e: any) {
      const updated = { ...purchasedIds, [item.id]: true };
      setPurchasedIds(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setShowPreview(false);
      setSelectedItem(null);
      Alert.alert(`${item.emoji} Purchased!`, `${item.name} has been added to your sanctuary!`);
    }
  };

  const categoryItems = SHOP_ITEMS.filter((i) => i.category === activeCategory);
  const purchasedCount = Object.keys(purchasedIds).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Sanctuary Shop</Text>
            <Text style={styles.headerSub}>Customize your animal haven</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Your Eco-Credits</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceEmoji}>🍀</Text>
              <Text style={styles.balanceAmount}>{stats?.current_coins || 0}</Text>
            </View>
          </View>
          <View style={styles.balanceRight}>
            <Text style={styles.ownedCount}>{purchasedCount}</Text>
            <Text style={styles.ownedLabel}>items owned</Text>
          </View>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {(Object.keys(CATEGORY_INFO) as ShopCategory[]).map((cat) => {
            const info = CATEGORY_INFO[cat];
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTab, isActive && { backgroundColor: info.color + '20', borderColor: info.color }]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={styles.categoryTabEmoji}>{info.emoji}</Text>
                <Text style={[styles.categoryTabText, isActive && { color: info.color, fontWeight: '700' as const }]}>{info.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Item Grid */}
        <View style={styles.itemGrid}>
          {categoryItems.map((item) => {
            const owned = !!purchasedIds[item.id];
            const canAfford = (stats?.current_coins || 0) >= item.price;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, owned && styles.itemCardOwned]}
                onPress={() => { setSelectedItem(item); setShowPreview(true); }}
                activeOpacity={0.8}
              >
                {owned && (
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedBadgeText}>Owned</Text>
                  </View>
                )}
                <View style={[styles.itemRarityDot, { backgroundColor: RARITY_COLORS[item.rarity] }]} />
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.itemPrice, !canAfford && !owned && styles.itemPriceCantAfford]}>
                  <Text style={styles.itemPriceEmoji}>🍀</Text>
                  <Text style={[styles.itemPriceText, !canAfford && !owned && styles.itemPriceTextCantAfford]}>
                    {item.price}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Item Preview Modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewContent}>
            <View style={styles.previewHandle} />
            {selectedItem && (() => {
              const owned = !!purchasedIds[selectedItem.id];
              const canAfford = (stats?.current_coins || 0) >= selectedItem.price;
              const catInfo = CATEGORY_INFO[selectedItem.category];
              return (
                <>
                  <View style={[styles.previewEmojiCircle, { backgroundColor: catInfo.color + '15' }]}>
                    <Text style={styles.previewEmoji}>{selectedItem.emoji}</Text>
                  </View>
                  <Text style={styles.previewName}>{selectedItem.name}</Text>
                  <View style={[styles.previewRarity, { backgroundColor: RARITY_COLORS[selectedItem.rarity] }]}>
                    <Text style={styles.previewRarityText}>{selectedItem.rarity.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.previewDesc}>{selectedItem.description}</Text>
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPriceEmoji}>🍀</Text>
                    <Text style={styles.previewPriceAmount}>{selectedItem.price}</Text>
                    <Text style={styles.previewPriceLabel}>eco-credits</Text>
                  </View>

                  {owned ? (
                    <View style={styles.previewOwnedMsg}>
                      <Text style={styles.previewOwnedEmoji}>✅</Text>
                      <Text style={styles.previewOwnedText}>You already own this item!</Text>
                    </View>
                  ) : !canAfford ? (
                    <View style={styles.previewCantAfford}>
                      <Text style={styles.previewCantAffordText}>
                        You need {selectedItem.price - (stats?.current_coins || 0)} more eco-credits
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.previewButtons}>
                    {!owned && (
                      <TouchableOpacity
                        style={[styles.buyButton, !canAfford && styles.buyButtonDisabled]}
                        onPress={() => purchaseItem(selectedItem)}
                        disabled={!canAfford}
                      >
                        <Text style={styles.buyButtonText}>
                          {canAfford ? 'Purchase' : 'Not Enough Credits'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.previewClose}
                      onPress={() => { setShowPreview(false); setSelectedItem(null); }}
                    >
                      <Text style={styles.previewCloseText}>{owned ? 'Close' : 'Maybe Later'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const ITEM_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  profileButtonEmoji: {
    fontSize: 20,
  },
  balanceCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.medium,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceEmoji: {
    fontSize: 28,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.tertiary,
  },
  balanceRight: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '25',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
  },
  ownedCount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  ownedLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  categoryRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    gap: 5,
  },
  categoryTabEmoji: {
    fontSize: 16,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: ITEM_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
    ...shadows.small,
  },
  itemCardOwned: {
    backgroundColor: '#F0F7F0',
    borderColor: colors.primary + '40',
  },
  ownedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  ownedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  itemRarityDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  itemPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tertiary + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  itemPriceCantAfford: {
    backgroundColor: colors.error + '12',
  },
  itemPriceEmoji: {
    fontSize: 12,
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.tertiary,
  },
  itemPriceTextCantAfford: {
    color: colors.error,
  },
  // Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  previewContent: {
    backgroundColor: '#FAFCFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
  },
  previewHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
    marginBottom: spacing.lg,
  },
  previewEmojiCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewEmoji: {
    fontSize: 48,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  previewRarity: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: spacing.md,
  },
  previewRarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  previewDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  previewPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  previewPriceEmoji: {
    fontSize: 22,
  },
  previewPriceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.tertiary,
  },
  previewPriceLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  previewOwnedMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    marginBottom: spacing.md,
    gap: 6,
  },
  previewOwnedEmoji: {
    fontSize: 16,
  },
  previewOwnedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  previewCantAfford: {
    backgroundColor: colors.error + '12',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    marginBottom: spacing.md,
  },
  previewCantAffordText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  previewButtons: {
    width: '100%',
    gap: spacing.sm,
  },
  buyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    ...shadows.small,
  },
  buyButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.6,
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  previewClose: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  previewCloseText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
