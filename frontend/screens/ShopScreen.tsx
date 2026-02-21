import React, { useState, useCallback } from 'react';
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
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { shopAPI, statsAPI, badgesAPI, UserStats } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { shopAccessories, shopDecorations } from '../assets/shop';

const { width } = Dimensions.get('window');

type ShopCategory = 'accessories' | 'decorations';

interface ShopItem {
  id: string;
  name: string;
  imageKey: string;
  description: string;
  price: number;
  category: ShopCategory;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const SHOP_ITEMS: ShopItem[] = [
  // Accessories
  { id: 'acc_tophat', name: 'Top Hat', imageKey: 'tophat', description: 'A dapper top hat for your most distinguished animal', price: 40, category: 'accessories', rarity: 'common' },
  { id: 'acc_sunnies', name: 'Sunnies', imageKey: 'sunnies', description: 'Cool shades for the coolest creatures', price: 35, category: 'accessories', rarity: 'common' },
  { id: 'acc_crown', name: 'Crown', imageKey: 'crown', description: 'A royal crown fit for the king of the sanctuary', price: 80, category: 'accessories', rarity: 'epic' },
  { id: 'acc_gradcap', name: 'Graduation Cap', imageKey: 'gradcap', description: 'Celebrate your study achievements in style', price: 60, category: 'accessories', rarity: 'rare' },
  { id: 'acc_eyemask', name: 'Eye Mask', imageKey: 'eyemask', description: 'For animals that deserve a cozy rest after your study session', price: 45, category: 'accessories', rarity: 'common' },
  { id: 'acc_partyhat', name: 'Party Hat', imageKey: 'partyhat', description: 'A festive party hat for celebration time', price: 50, category: 'accessories', rarity: 'rare' },
  { id: 'acc_halo', name: 'Halo', imageKey: 'halo', description: 'A golden halo for your most angelic animal', price: 90, category: 'accessories', rarity: 'epic' },
  { id: 'acc_bow', name: 'Bow Tie', imageKey: 'bow', description: 'A classy white bow tie for formal occasions', price: 55, category: 'accessories', rarity: 'rare' },

  // Decorations
  { id: 'dec_daisy', name: 'Daisy Patch', imageKey: 'daisy', description: 'A cheerful bunch of daisies to brighten my sanctuary', price: 30, category: 'decorations', rarity: 'common' },
  { id: 'dec_mushroom', name: 'Mushroom', imageKey: 'mushroom', description: 'A whimsical fairy-tale mushroom', price: 40, category: 'decorations', rarity: 'common' },
  { id: 'dec_tree', name: 'Tree', imageKey: 'tree', description: 'A shady tree for animals to rest under', price: 55, category: 'decorations', rarity: 'rare' },
  { id: 'dec_tulips', name: 'Tulips', imageKey: 'tulips', description: 'A vibrant cluster of colourful tulips', price: 50, category: 'decorations', rarity: 'rare' },
  { id: 'dec_stones', name: 'Zen Stones', imageKey: 'stones', description: 'A calming stack of smooth zen stones', price: 45, category: 'decorations', rarity: 'common' },
  { id: 'dec_bamboo', name: 'Bamboo', imageKey: 'bamboo', description: 'Tall green bamboo stalks swaying gently', price: 65, category: 'decorations', rarity: 'rare' },
];

function getItemImage(item: ShopItem): ImageSourcePropType | null {
  if (item.category === 'accessories') return shopAccessories[item.imageKey] || null;
  if (item.category === 'decorations') return shopDecorations[item.imageKey] || null;
  return null;
}

const CATEGORY_INFO: Record<ShopCategory, { label: string; emoji: string; color: string }> = {
  accessories: { label: 'Accessories', emoji: '🎀', color: '#3B5466' },
  decorations: { label: 'Decorations', emoji: '✨', color: '#5E7F6E' },
};

const RARITY_COLORS: Record<string, string> = {
  common: '#A9BDAF',
  rare: '#5E7F6E',
  epic: '#3B5466',
  legendary: '#2F4A3E',
};

const STORAGE_KEY_PREFIX = 'endura_purchased_items_';

export default function ShopScreen() {
  const navigation = useNavigation<any>();
  const { refreshUser, user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('accessories');
  const [purchasedIds, setPurchasedIds] = useState<Record<string, number>>({});
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${user?.id || 'anon'}`;

  const loadData = async () => {
    try {
      const [statsData, storedPurchases] = await Promise.all([
        statsAPI.getStats(),
        AsyncStorage.getItem(storageKey),
      ]);
      setStats(statsData);
      if (storedPurchases) {
        const parsed = JSON.parse(storedPurchases);
        const migrated: Record<string, number> = {};
        for (const [key, val] of Object.entries(parsed)) {
          migrated[key] = typeof val === 'number' ? (val as number) : (val ? 1 : 0);
        }
        setPurchasedIds(migrated);
      } else {
        setPurchasedIds({});
      }
    } catch (e) {
      console.error('Failed to load shop data:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [storageKey]));

  const purchaseItem = async (item: ShopItem) => {
    const coins = stats?.current_coins || 0;
    if (coins < item.price) {
      Alert.alert('Not Enough Eco-Credits', `You need ${item.price - coins} more eco-credits. Keep studying to earn more!`);
      return;
    }

    try {
      await shopAPI.spendCoins(item.price);
    } catch (e: any) {
      Alert.alert('Purchase Failed', e.message || 'Something went wrong. Please try again.');
      return;
    }

    const currentCount = purchasedIds[item.id] || 0;
    try {
      const updated = { ...purchasedIds, [item.id]: currentCount + 1 };
      setPurchasedIds(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      await refreshUser();
      const newStats = await statsAPI.getStats();
      setStats(newStats);
      try { await badgesAPI.checkBadges(); } catch {}
      setShowPreview(false);
      setSelectedItem(null);
      Alert.alert(
        'Purchased!',
        `${item.name} has been added to my sanctuary! Visit Collection to see it.`
      );
    } catch (e: any) {
      const updated = { ...purchasedIds, [item.id]: currentCount + 1 };
      setPurchasedIds(updated);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      setShowPreview(false);
      setSelectedItem(null);
      Alert.alert('Purchased!', `${item.name} has been added to my sanctuary!`);
    }
  };

  const categoryItems = SHOP_ITEMS.filter((i) => i.category === activeCategory);
  const purchasedCount = Object.values(purchasedIds).reduce((sum, n) => sum + (n || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <LinearGradient
          colors={['#7DA9A4', '#5F8C87']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View>
            <Text style={styles.headerTitle}>Sanctuary Shop</Text>
            <Text style={styles.headerSub}>Customize your animal haven</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Balance Card */}
        <LinearGradient
          colors={['#5F8C87', '#7DA9A4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.balanceCard}
        >
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
        </LinearGradient>

        {/* Category Tabs */}
        <View style={styles.categoryRow}>
          {(Object.keys(CATEGORY_INFO) as ShopCategory[]).map((cat) => {
            const info = CATEGORY_INFO[cat];
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTab, isActive && { borderColor: info.color }]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                {isActive ? (
                  <LinearGradient
                    colors={['#7DA9A4', '#5F8C87']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.categoryTabGradient}
                  >
                    <Text style={styles.categoryTabEmoji}>{info.emoji}</Text>
                    <Text style={[styles.categoryTabText, { color: '#FFFFFF', fontWeight: '700' as const }]}>{info.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.categoryTabInner}>
                    <Text style={styles.categoryTabEmoji}>{info.emoji}</Text>
                    <Text style={[styles.categoryTabText, { color: colors.textSecondary }]}>{info.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Item Grid */}
        <View style={styles.itemGrid}>
          {categoryItems.map((item) => {
            const ownedCount = purchasedIds[item.id] || 0;
            const owned = ownedCount > 0;
            const canAfford = (stats?.current_coins || 0) >= item.price;
            const img = getItemImage(item);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.itemCard, owned && styles.itemCardOwned]}
                onPress={() => { setSelectedItem(item); setShowPreview(true); }}
                activeOpacity={0.8}
              >
                {owned && (
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedBadgeText}>×{ownedCount}</Text>
                  </View>
                )}
                <View style={[styles.itemRarityDot, { backgroundColor: RARITY_COLORS[item.rarity] }]} />
                <View style={styles.itemImageWrap}>
                  {img ? (
                    <Image source={img} style={styles.itemImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.itemFallbackEmoji}>🎁</Text>
                  )}
                </View>
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
          <LinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.previewContent}
          >
            <View style={styles.previewHandle} />
            {selectedItem && (() => {
              const ownedCount = purchasedIds[selectedItem.id] || 0;
              const canAfford = (stats?.current_coins || 0) >= selectedItem.price;
              const catInfo = CATEGORY_INFO[selectedItem.category];
              const img = getItemImage(selectedItem);
              return (
                <>
                  <View style={[styles.previewImageCircle, { backgroundColor: catInfo.color + '15' }]}>
                    {img ? (
                      <Image source={img} style={styles.previewImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.previewFallbackEmoji}>🎁</Text>
                    )}
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

                  {ownedCount > 0 && (
                    <View style={styles.previewOwnedMsg}>
                      <Text style={styles.previewOwnedEmoji}>✅</Text>
                      <Text style={styles.previewOwnedText}>You own {ownedCount} of this item</Text>
                    </View>
                  )}

                  {!canAfford && (
                    <View style={styles.previewCantAfford}>
                      <Text style={styles.previewCantAffordText}>
                        You need {selectedItem.price - (stats?.current_coins || 0)} more eco-credits
                      </Text>
                    </View>
                  )}

                  <View style={styles.previewButtons}>
                    <TouchableOpacity
                      style={[styles.buyButton, !canAfford && styles.buyButtonDisabled]}
                      onPress={() => purchaseItem(selectedItem)}
                      disabled={!canAfford}
                      activeOpacity={0.8}
                    >
                      {canAfford ? (
                        <LinearGradient
                          colors={['#7DA9A4', '#5F8C87']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.buyButtonGradient}
                        >
                          <Text style={styles.buyButtonText}>{ownedCount > 0 ? 'Buy Another' : 'Purchase'}</Text>
                        </LinearGradient>
                      ) : (
                        <Text style={styles.buyButtonText}>Not Enough Credits</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.previewClose}
                      onPress={() => { setShowPreview(false); setSelectedItem(null); }}
                    >
                      <Text style={styles.previewCloseText}>Maybe Later</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const ITEM_WIDTH = (width - spacing.lg * 2 - spacing.sm) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7EFEA',
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
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: 2,
    opacity: 0.9,
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
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.medium,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    opacity: 0.9,
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
    color: '#FFFFFF',
  },
  balanceRight: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
  },
  ownedCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ownedLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    opacity: 0.9,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryTab: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  categoryTabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  categoryTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  categoryTabEmoji: {
    fontSize: 16,
  },
  categoryTabText: {
    fontSize: 14,
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
    backgroundColor: '#E7EFEA',
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
  itemImageWrap: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  itemImage: {
    width: 90,
    height: 90,
  },
  itemFallbackEmoji: {
    fontSize: 40,
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
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  previewContent: {
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
  previewImageCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  previewImage: {
    width: 110,
    height: 110,
  },
  previewFallbackEmoji: {
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
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.small,
  },
  buyButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
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
