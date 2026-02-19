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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { animalsAPI, UserAnimal, Animal } from '../services/api';
import { getAnimalImage } from '../assets/animals';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

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

const generatePositions = (count: number, containerW: number, containerH: number) => {
  const positions: { left: number; bottom: number; scale: number }[] = [];
  const animalSize = 64;
  const minGap = 10;
  const padding = 10;
  const usableW = containerW - padding * 2;
  const maxBottom = containerH * 0.38;

  const cols = Math.max(2, Math.min(5, Math.floor(usableW / (animalSize + minGap))));
  const rows = Math.ceil(count / cols);
  const cellW = usableW / cols;
  const rowGap = rows > 1 ? Math.min(maxBottom / rows, animalSize + minGap) : 0;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const itemsInRow = Math.min(cols, count - row * cols);
    const rowWidth = itemsInRow * cellW;
    const rowStart = padding + (usableW - rowWidth) / 2;
    const isOddRow = row % 2 === 1;
    const stagger = isOddRow ? cellW * 0.35 : 0;
    const centerX = rowStart + col * cellW + cellW / 2 - animalSize / 2 + stagger;
    const left = Math.max(padding, Math.min(centerX, containerW - animalSize - padding));
    const bottom = 16 + row * rowGap;
    const scale = 0.92 + Math.sin(i * 2.3) * 0.08;

    positions.push({ left, bottom, scale });
  }
  return positions;
};

const PURCHASED_ITEMS_KEY = 'endura_purchased_items';

const DECORATION_EMOJIS: Record<string, string> = {
  pond: '🏊', cave: '🕳️', treehouse: '🌳', bamboo: '🎋', waterfall: '🏞️', springs: '♨️',
  stone_path: '🪨', flower_path: '🌺', bridge: '🌉', lanterns: '🏮',
  flowers: '🌷', mushrooms: '🍄', rainbow: '🌈', fireflies: '✨', swing: '🪢', stars: '🌙',
};

export default function CollectionScreen() {
  const navigation = useNavigation<any>();
  const [myAnimals, setMyAnimals] = useState<UserAnimal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<UserAnimal | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSanctuaryModal, setShowSanctuaryModal] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, boolean>>({});

  const loadPurchases = async () => {
    try {
      const raw = await AsyncStorage.getItem(PURCHASED_ITEMS_KEY);
      if (raw) setPurchasedItems(JSON.parse(raw));
    } catch (e) {}
  };

  const ownedDecorations = Object.keys(purchasedItems)
    .filter(id => purchasedItems[id])
    .map(id => {
      const key = id.replace(/^(hab_|path_|dec_|acc_)/, '');
      return DECORATION_EMOJIS[key];
    })
    .filter(Boolean);

  const loadData = async () => {
    try {
      loadPurchases();
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
        <View style={styles.header}>
          <Text style={styles.title}>My Collection</Text>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.profileButtonEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

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
              {collectedIds.size} of {allAnimals.length} species
            </Text>
            <Text style={styles.progressHint}>
              Keep studying to protect endangered species!
            </Text>
          </View>
        </View>

        {/* Animal Sanctuary */}
        {myAnimals.length > 0 && (() => {
          const previewW = SCREEN_WIDTH - spacing.lg * 2;
          const previewH = 200;
          const previewPositions = generatePositions(Math.min(myAnimals.length, 8), previewW, previewH);
          return (
            <View style={styles.sanctuarySection}>
              <Text style={styles.sanctuaryTitle}>🌿 Your Animal Sanctuary</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowSanctuaryModal(true)}
              >
                <View style={styles.sanctuaryContainer}>
                  <View style={styles.sanctuaryLandscape}>
                    <LottieView
                      source={require('../assets/nature-landscape.json')}
                      autoPlay
                      loop
                      style={styles.sanctuaryLottie}
                      resizeMode="cover"
                    />
                  </View>
                  {ownedDecorations.length > 0 && (
                    <View style={styles.decorationRowPreview}>
                      {ownedDecorations.slice(0, 6).map((emoji, i) => (
                        <Text key={i} style={[styles.decorationEmojiPreview, { left: `${8 + (i * 16) % 75}%`, bottom: 10 + (i % 3) * 8 } as any]}>
                          {emoji}
                        </Text>
                      ))}
                    </View>
                  )}
                  <View style={styles.sanctuaryAnimals}>
                    {myAnimals.slice(0, 8).map((userAnimal, index) => {
                      const imageSource = getAnimalImage(userAnimal.animal.name);
                      const pos = previewPositions[index];
                      return (
                        <View
                          key={userAnimal.id}
                          style={[
                            styles.sanctuaryAnimal,
                            { bottom: pos.bottom, left: pos.left, transform: [{ scale: pos.scale }] },
                          ]}
                        >
                          {imageSource ? (
                            <Image source={imageSource} style={styles.sanctuaryAnimalImage} />
                          ) : (
                            <Text style={styles.sanctuaryAnimalEmoji}>
                              {animalEmojis[userAnimal.animal.name] || '🦁'}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.sanctuaryGround} />
                  {myAnimals.length > 8 && (
                    <View style={styles.sanctuaryMoreBadge}>
                      <Text style={styles.sanctuaryMoreText}>+{myAnimals.length - 8} more</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewSanctuaryBtn}
                onPress={() => setShowSanctuaryModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.viewSanctuaryBtnEmoji}>🏞️</Text>
                <Text style={styles.viewSanctuaryBtnText}>View Whole Sanctuary</Text>
              </TouchableOpacity>
              <Text style={styles.sanctuaryCaption}>
                {myAnimals.length === 1
                  ? 'Your first friend is settling in!'
                  : `${myAnimals.length} friends roaming happily in your sanctuary`}
              </Text>

              {/* Shop Entry */}
              <TouchableOpacity
                style={styles.shopEntryBtn}
                onPress={() => navigation.navigate('Shop')}
                activeOpacity={0.8}
              >
                <Text style={styles.shopEntryEmoji}>🛍️</Text>
                <View>
                  <Text style={styles.shopEntryTitle}>Sanctuary Shop</Text>
                  <Text style={styles.shopEntrySub}>Habitats, paths, accessories & more</Text>
                </View>
                <Text style={styles.shopEntryArrow}>›</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* My Animals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Animals</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{myAnimals.length}</Text>
          </View>
        </View>

        {myAnimals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🥚</Text>
            <Text style={styles.emptyTitle}>No Animals Yet</Text>
            <Text style={styles.emptyText}>
              Complete study sessions to earn eco-credits and hatch eggs!
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {myAnimals.map((userAnimal) => {
              const imageSource = getAnimalImage(userAnimal.animal.name);
              return (
                <TouchableOpacity
                  key={userAnimal.id}
                  style={[
                    styles.animalCard,
                    { borderLeftColor: rarityColors[userAnimal.animal.rarity] },
                  ]}
                  onPress={() => openAnimalDetail(userAnimal)}
                >
                  {imageSource ? (
                    <Image source={imageSource} style={styles.animalImage} />
                  ) : (
                    <Text style={styles.animalEmoji}>
                      {animalEmojis[userAnimal.animal.name] || '🦁'}
                    </Text>
                  )}
                  <Text style={styles.animalName} numberOfLines={2}>
                    {userAnimal.nickname || userAnimal.animal.name}
                  </Text>
                  <Text style={styles.tapToNickname}>tap to nickname</Text>
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
              );
            })}
          </View>
        )}

        {/* All Animals (Dex) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Animals</Text>
        </View>
        <View style={styles.dexGrid}>
          {allAnimals.map((animal) => {
            const isCollected = collectedIds.has(animal.id);
            const imageSource = getAnimalImage(animal.name);
            return (
              <View
                key={animal.id}
                style={[
                  styles.dexCard,
                  !isCollected && styles.dexCardLocked,
                ]}
              >
                {isCollected && imageSource ? (
                  <Image source={imageSource} style={styles.dexImage} />
                ) : (
                  <Text style={[styles.dexEmoji, !isCollected && styles.dexEmojiLocked]}>
                    {isCollected ? animalEmojis[animal.name] || '🦁' : '🥚'}
                  </Text>
                )}
                {!isCollected && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockEmoji}>🔒</Text>
                  </View>
                )}
                <Text style={[styles.dexName, !isCollected && styles.dexNameLocked]} numberOfLines={2}>
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
                    {getAnimalImage(selectedAnimal.animal.name) ? (
                      <Image 
                        source={getAnimalImage(selectedAnimal.animal.name)} 
                        style={styles.modalImage} 
                      />
                    ) : (
                      <Text style={styles.modalEmoji}>
                        {animalEmojis[selectedAnimal.animal.name] || '🦁'}
                      </Text>
                    )}
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

                  {/* Nickname Section */}
                  <View style={styles.nicknameSection}>
                    <Text style={styles.nicknameLabel}>Give a Nickname</Text>
                    <View style={styles.nicknameRow}>
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
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
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

                </>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Full Sanctuary Modal */}
      <Modal visible={showSanctuaryModal} transparent animationType="fade">
        <View style={styles.sanctuaryModalOverlay}>
          <View style={styles.sanctuaryModalContent}>
            {/* Header */}
            <View style={styles.sanctuaryModalHeader}>
              <View>
                <Text style={styles.sanctuaryModalTitle}>🌿 Your Sanctuary</Text>
                <Text style={styles.sanctuaryModalSub}>
                  {myAnimals.length} {myAnimals.length === 1 ? 'friend' : 'friends'} living here
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sanctuaryModalClose}
                onPress={() => setShowSanctuaryModal(false)}
              >
                <Text style={styles.sanctuaryModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Landscape Scene */}
            <View style={styles.sanctuaryModalScene}>
              <View style={styles.sanctuaryModalLandscapeBg}>
                <LottieView
                  source={require('../assets/nature-landscape.json')}
                  autoPlay
                  loop
                  style={styles.sanctuaryModalLottie}
                  resizeMode="cover"
                />
              </View>

              {/* Decorative elements */}
              <Text style={styles.sanctuaryModalCloud1}>☁️</Text>
              <Text style={styles.sanctuaryModalCloud2}>☁️</Text>
              <Text style={styles.sanctuaryModalSun}>🌤️</Text>

              {/* Purchased decorations */}
              {ownedDecorations.length > 0 && (
                <View style={styles.decorationRow}>
                  {ownedDecorations.map((emoji, i) => (
                    <Text key={i} style={[styles.decorationEmoji, { left: `${10 + (i * 18) % 80}%`, bottom: 18 + (i % 3) * 12 } as any]}>
                      {emoji}
                    </Text>
                  ))}
                </View>
              )}

              {/* All animals */}
              <View style={styles.sanctuaryModalAnimals}>
                {(() => {
                  const modalW = SCREEN_WIDTH - spacing.sm * 4;
                  const modalH = SCREEN_HEIGHT * 0.62;
                  const positions = generatePositions(myAnimals.length, modalW, modalH);
                  return myAnimals.map((userAnimal, index) => {
                    const imageSource = getAnimalImage(userAnimal.animal.name);
                    const pos = positions[index];
                    return (
                      <TouchableOpacity
                        key={userAnimal.id}
                        style={[
                          styles.sanctuaryModalAnimal,
                          { bottom: pos.bottom, left: pos.left, transform: [{ scale: pos.scale }] },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowSanctuaryModal(false);
                          setTimeout(() => {
                            setSelectedAnimal(userAnimal);
                            setNicknameInput(userAnimal.nickname || '');
                            setShowModal(true);
                          }, 300);
                        }}
                      >
                        {imageSource ? (
                          <Image source={imageSource} style={styles.sanctuaryModalAnimalImg} />
                        ) : (
                          <Text style={styles.sanctuaryModalAnimalEmoji}>
                            {animalEmojis[userAnimal.animal.name] || '🦁'}
                          </Text>
                        )}
                        <View style={styles.sanctuaryModalNameTag}>
                          <Text style={styles.sanctuaryModalNameText} numberOfLines={1}>
                            {userAnimal.nickname || userAnimal.animal.name.split(' ').pop()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <View style={styles.sanctuaryModalGround} />
            </View>

            {/* Footer */}
            <View style={styles.sanctuaryModalFooter}>
              <Text style={styles.sanctuaryModalFooterText}>
                Tap any animal to see its details
              </Text>
              <TouchableOpacity
                style={styles.sanctuaryModalDoneBtn}
                onPress={() => setShowSanctuaryModal(false)}
              >
                <Text style={styles.sanctuaryModalDoneBtnText}>Close Sanctuary</Text>
              </TouchableOpacity>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  profileButtonEmoji: {
    fontSize: 22,
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
  sanctuarySection: {
    marginBottom: spacing.lg,
  },
  sanctuaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sanctuaryContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#D4EDDA',
  },
  sanctuaryLandscape: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryLottie: {
    width: '100%',
    height: 230,
    position: 'absolute',
    top: -20,
    left: 0,
  },
  sanctuaryAnimals: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryAnimal: {
    position: 'absolute',
  },
  sanctuaryAnimalImage: {
    width: 58,
    height: 58,
  },
  sanctuaryAnimalEmoji: {
    fontSize: 38,
  },
  sanctuaryGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(76, 145, 80, 0.15)',
  },
  sanctuaryMoreBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sanctuaryMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  viewSanctuaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    gap: 6,
  },
  viewSanctuaryBtnEmoji: {
    fontSize: 16,
  },
  viewSanctuaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  sanctuaryCaption: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // Full Sanctuary Modal
  sanctuaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  sanctuaryModalContent: {
    flex: 1,
    backgroundColor: '#F0F7F0',
    borderRadius: 28,
    overflow: 'hidden',
    marginVertical: spacing.md,
  },
  sanctuaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sanctuaryModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sanctuaryModalSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  sanctuaryModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sanctuaryModalCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  sanctuaryModalScene: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#C8E6C9',
    marginHorizontal: spacing.sm,
    borderRadius: 20,
  },
  sanctuaryModalLandscapeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryModalLottie: {
    width: '100%',
    height: '120%',
    position: 'absolute',
    top: -30,
    left: 0,
  },
  sanctuaryModalCloud1: {
    position: 'absolute',
    top: 12,
    left: '15%',
    fontSize: 28,
    opacity: 0.5,
  } as any,
  sanctuaryModalCloud2: {
    position: 'absolute',
    top: 22,
    right: '12%',
    fontSize: 22,
    opacity: 0.4,
  } as any,
  sanctuaryModalSun: {
    position: 'absolute',
    top: 8,
    right: '35%',
    fontSize: 32,
    opacity: 0.6,
  } as any,
  sanctuaryModalAnimals: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryModalAnimal: {
    position: 'absolute',
    alignItems: 'center',
  },
  sanctuaryModalAnimalImg: {
    width: 60,
    height: 60,
  },
  sanctuaryModalAnimalEmoji: {
    fontSize: 40,
  },
  sanctuaryModalNameTag: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
    maxWidth: 70,
  },
  sanctuaryModalNameText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sanctuaryModalGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(76, 145, 80, 0.12)',
  },
  decorationRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 3,
  },
  decorationEmoji: {
    position: 'absolute',
    fontSize: 22,
  },
  decorationRowPreview: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 3,
  },
  decorationEmojiPreview: {
    position: 'absolute',
    fontSize: 16,
  },
  shopEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  shopEntryEmoji: {
    fontSize: 26,
  },
  shopEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shopEntrySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  shopEntryArrow: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  sanctuaryModalFooter: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sanctuaryModalFooterText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  sanctuaryModalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    width: '100%',
    alignItems: 'center',
  },
  sanctuaryModalDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
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
  animalImage: {
    width: 70,
    height: 70,
    marginBottom: spacing.sm,
  },
  animalName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  tapToNickname: {
    fontSize: 10,
    fontStyle: 'italic',
    color: colors.textMuted,
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
  dexImage: {
    width: 45,
    height: 45,
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
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 13,
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
  modalImage: {
    width: 120,
    height: 120,
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
    marginBottom: spacing.lg,
  },
  nicknameLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nicknameInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
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
