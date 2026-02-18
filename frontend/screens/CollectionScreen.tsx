import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { animalsAPI, UserAnimal, Animal } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.md) / 2;

// Emoji representations for animals (synced with backend - 21 animals)
const animalEmojis: Record<string, string> = {
  'Sunda Island Tiger': '🐅',
  'Javan Rhino': '🦏',
  'Amur Leopard': '🐆',
  'Mountain Gorilla': '🦍',
  'Tapanuli Orangutan': '🦧',
  'Polar Bear': '🐻‍❄️',
  'African Forest Elephant': '🐘',
  'Hawksbill Turtle': '🐢',
  'Calamian Deer': '🦌',
  'Axolotl': '🦎',
  'Red Wolf': '🐺',
  'Monarch Butterfly': '🦋',
  'Red Panda': '🐼',
  'Panda': '🐼',
  'Mexican Bobcat': '🐱',
  'Chinchilla': '🐭',
  'Otter': '🦦',
  'Koala': '🐨',
  'Langur Monkey': '🐒',
  'Pacific Pocket Mouse': '🐁',
  'Wallaby': '🦘',
};

const rarityColors: Record<string, string> = {
  common: colors.common,
  rare: colors.rare,
  epic: colors.epic,
  legendary: colors.legendary,
};

// Habitat and fun fact data for animals
const animalDetails: Record<string, { habitat: string; funFact: string }> = {
  'Red Panda': { habitat: 'Himalayan forests of Nepal, India, Bhutan, Myanmar, and China', funFact: 'Red pandas spend most of their lives in trees and even sleep aloft.' },
  'Sea Turtle': { habitat: 'Tropical and subtropical oceans worldwide', funFact: 'Sea turtles can hold their breath for up to 7 hours while sleeping.' },
  'Penguin': { habitat: 'Antarctica and sub-Antarctic islands', funFact: 'Emperor penguins can dive to depths of 1,800 feet!' },
  'Koala': { habitat: 'Eucalyptus forests of eastern Australia', funFact: 'Koalas sleep up to 22 hours a day to conserve energy.' },
  'Flamingo': { habitat: 'Lagoons and lakes in Africa, Asia, Americas, and Europe', funFact: 'Flamingos are born gray and turn pink from eating shrimp.' },
  'Giant Panda': { habitat: 'Bamboo forests in central China mountains', funFact: 'Pandas spend 12 hours a day eating up to 38kg of bamboo.' },
  'Snow Leopard': { habitat: 'High mountains of Central Asia', funFact: 'Snow leopards can leap up to 50 feet in a single bound.' },
  'Orangutan': { habitat: 'Rainforests of Borneo and Sumatra', funFact: 'Orangutans share 97% of their DNA with humans.' },
  'Elephant': { habitat: 'Savannas, forests, and deserts of Africa and Asia', funFact: 'Elephants can recognize themselves in mirrors.' },
  'Polar Bear': { habitat: 'Arctic sea ice and tundra', funFact: 'Polar bear fur is actually transparent, not white!' },
  'Tiger': { habitat: 'Forests and grasslands of Asia', funFact: 'No two tigers have the same stripe pattern.' },
  'Gorilla': { habitat: 'Tropical forests of central Africa', funFact: 'Gorillas can learn sign language and communicate with humans.' },
  'Blue Whale': { habitat: 'All oceans except the Arctic', funFact: 'A blue whale\'s heart is the size of a small car.' },
  'Cheetah': { habitat: 'Grasslands and savannas of Africa', funFact: 'Cheetahs can accelerate from 0 to 60 mph in 3 seconds.' },
  'Rhinoceros': { habitat: 'Grasslands and tropical forests of Africa and Asia', funFact: 'Rhino horns are made of keratin, like human fingernails.' },
  'Amur Leopard': { habitat: 'Temperate forests of Far Eastern Russia', funFact: 'Only about 100 Amur leopards remain in the wild.' },
  'Vaquita': { habitat: 'Northern Gulf of California, Mexico', funFact: 'The vaquita is the world\'s rarest marine mammal.' },
  'Sumatran Rhino': { habitat: 'Tropical rainforests of Sumatra and Borneo', funFact: 'Sumatran rhinos are the smallest and hairiest of all rhino species.' },
  'Kakapo': { habitat: 'Islands of New Zealand', funFact: 'The kakapo is the only flightless parrot in the world.' },
  'Axolotl': { habitat: 'Lake Xochimilco near Mexico City', funFact: 'Axolotls can regenerate their limbs, heart, and even parts of their brain.' },
};

const conservationStatusInfo: Record<string, { color: string; description: string }> = {
  'Least Concern': { color: '#4CAF50', description: 'Population is stable and widespread' },
  'Near Threatened': { color: '#8BC34A', description: 'May become endangered in the near future' },
  'Vulnerable': { color: '#FFC107', description: 'High risk of extinction in the wild' },
  'Endangered': { color: '#FF9800', description: 'Very high risk of extinction in the wild' },
  'Critically Endangered': { color: '#F44336', description: 'Extremely high risk of extinction' },
};

// Progress Ring Component
const ProgressRing = ({ progress, size = 80 }: { progress: number; size?: number }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.grass} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.surfaceAlt}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

export default function CollectionScreen() {
  const [myAnimals, setMyAnimals] = useState<UserAnimal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<UserAnimal | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadData = async () => {
    try {
      const [myData, allData] = await Promise.all([
        animalsAPI.getMyAnimals(),
        animalsAPI.getAllAnimals(),
      ]);
      setMyAnimals(myData);
      setAllAnimals(allData);
    } catch (error) {
      console.error('Failed to load animals:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const openAnimalDetail = (animal: UserAnimal) => {
    setSelectedAnimal(animal);
    setNicknameInput(animal.nickname || '');
    setShowModal(true);
  };

  const saveNickname = async () => {
    if (!selectedAnimal || !nicknameInput.trim()) return;
    
    try {
      await animalsAPI.nameAnimal(selectedAnimal.id, nicknameInput.trim());
      await loadData();
      setShowModal(false);
      Alert.alert('Success', `${selectedAnimal.animal.name} is now named "${nicknameInput.trim()}"!`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Count collected animals by id
  const collectedIds = new Set(myAnimals.map((a) => a.animal.id));
  const collectionProgress = collectedIds.size / Math.max(allAnimals.length, 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>My Collection</Text>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressLeft}>
            <ProgressRing progress={collectionProgress} />
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressPercent}>
                {Math.round(collectionProgress * 100)}%
              </Text>
            </View>
          </View>
          <View style={styles.progressRight}>
            <Text style={styles.progressLabel}>Collection Progress</Text>
            <Text style={styles.progressValue}>
              {collectedIds.size} of {allAnimals.length}
            </Text>
            <Text style={styles.progressHint}>
              Keep studying to hatch more animals!
            </Text>
          </View>
        </View>

        {/* My Animals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Animals</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{myAnimals.length}</Text>
          </View>
        </View>

        {myAnimals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🥚</Text>
            <Text style={styles.emptyTitle}>No Animals Yet</Text>
            <Text style={styles.emptyText}>
              Complete study sessions to earn coins and hatch eggs!
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {myAnimals.map((userAnimal) => (
              <TouchableOpacity
                key={userAnimal.id}
                style={[
                  styles.animalCard,
                  { borderLeftColor: rarityColors[userAnimal.animal.rarity] },
                ]}
                onPress={() => openAnimalDetail(userAnimal)}
              >
                <Text style={styles.animalEmoji}>
                  {animalEmojis[userAnimal.animal.name] || '🦁'}
                </Text>
                <Text style={styles.animalName} numberOfLines={1}>
                  {userAnimal.nickname || userAnimal.animal.name}
                </Text>
                <View
                  style={[
                    styles.rarityBadge,
                    { backgroundColor: rarityColors[userAnimal.animal.rarity] + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.rarityText,
                      { color: rarityColors[userAnimal.animal.rarity] },
                    ]}
                  >
                    {userAnimal.animal.rarity.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* All Animals (Dex) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Animals</Text>
        </View>
        <View style={styles.dexGrid}>
          {allAnimals.map((animal) => {
            const isCollected = collectedIds.has(animal.id);
            return (
              <View
                key={animal.id}
                style={[
                  styles.dexCard,
                  !isCollected && styles.dexCardLocked,
                ]}
              >
                <Text style={[styles.dexEmoji, !isCollected && styles.dexEmojiLocked]}>
                  {isCollected ? animalEmojis[animal.name] || '🦁' : '🥚'}
                </Text>
                {!isCollected && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockEmoji}>🔒</Text>
                  </View>
                )}
                <Text style={[styles.dexName, !isCollected && styles.dexNameLocked]}>
                  {isCollected ? animal.name : '???'}
                </Text>
                {isCollected && (
                  <View
                    style={[
                      styles.dexRarityDot,
                      { backgroundColor: rarityColors[animal.rarity] },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Animal Detail Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalContent}>
              {selectedAnimal && (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setShowModal(false)}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.modalAnimalContainer}>
                    <Text style={styles.modalEmoji}>
                      {animalEmojis[selectedAnimal.animal.name] || '🦁'}
                    </Text>
                  </View>
                  
                  <Text style={styles.modalTitle}>
                    {selectedAnimal.nickname || selectedAnimal.animal.name}
                  </Text>
                  <Text style={styles.modalSpecies}>
                    {selectedAnimal.animal.species}
                  </Text>
                  
                  <View
                    style={[
                      styles.modalRarity,
                      { backgroundColor: rarityColors[selectedAnimal.animal.rarity] },
                    ]}
                  >
                    <Text style={styles.modalRarityText}>
                      {selectedAnimal.animal.rarity.toUpperCase()}
                    </Text>
                  </View>

                  {/* Conservation Status Section */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>🌍</Text>
                      <Text style={styles.infoSectionTitle}>Conservation Status</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: conservationStatusInfo[selectedAnimal.animal.conservation_status || '']?.color || colors.textMuted }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {selectedAnimal.animal.conservation_status || 'Unknown'}
                      </Text>
                    </View>
                    <Text style={styles.infoSectionText}>
                      {conservationStatusInfo[selectedAnimal.animal.conservation_status || '']?.description || 
                        'Help protect this species by learning more about conservation efforts.'}
                    </Text>
                  </View>

                  {/* Habitat Section */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>🏔️</Text>
                      <Text style={styles.infoSectionTitle}>Habitat</Text>
                    </View>
                    <Text style={styles.infoSectionText}>
                      {animalDetails[selectedAnimal.animal.name]?.habitat || 
                        'Various ecosystems around the world'}
                    </Text>
                  </View>

                  {/* Fun Fact Section */}
                  <View style={styles.funFactSection}>
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>💡</Text>
                      <Text style={styles.infoSectionTitle}>Fun Fact</Text>
                    </View>
                    <Text style={styles.funFactText}>
                      {animalDetails[selectedAnimal.animal.name]?.funFact || 
                        selectedAnimal.animal.description || 
                        'This amazing creature is part of your collection!'}
                    </Text>
                  </View>

                  {/* Nickname Section */}
                  <View style={styles.nicknameSection}>
                    <Text style={styles.nicknameLabel}>Give a Nickname</Text>
                    <TextInput
                      style={styles.nicknameInput}
                      placeholder="Enter nickname..."
                      placeholderTextColor={colors.textMuted}
                      value={nicknameInput}
                      onChangeText={setNicknameInput}
                      maxLength={20}
                    />
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={saveNickname}
                    >
                      <Text style={styles.saveButtonText}>Save Name</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.medium,
  },
  progressLeft: {
    position: 'relative',
    marginRight: spacing.lg,
  },
  progressTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  progressRight: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  progressHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  animalCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    ...shadows.small,
  },
  animalEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  animalName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  rarityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  dexCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
  },
  dexCardLocked: {
    opacity: 0.5,
    backgroundColor: colors.surfaceAlt,
  },
  dexEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  dexEmojiLocked: {
    opacity: 0.6,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockEmoji: {
    fontSize: 20,
    marginTop: -8,
  },
  dexName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  dexNameLocked: {
    color: colors.textMuted,
  },
  dexRarityDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollView: {
    maxHeight: '90%',
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 20,
    width: '100%',
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalAnimalContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalEmoji: {
    fontSize: 64,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSpecies: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  modalRarity: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  modalRarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  modalStatus: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  nicknameSection: {
    width: '100%',
  },
  nicknameLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  nicknameInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  // Info sections
  infoSection: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoSectionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoSectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  funFactSection: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  funFactText: {
    fontSize: 14,
    color: colors.primaryDark,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
