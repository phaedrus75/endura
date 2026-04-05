import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  ImageSourcePropType,
  LayoutChangeEvent,
} from 'react-native';
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import SwipeDismiss, { DragHandle } from '../components/SwipeDismiss';
import { useAuth } from '../contexts/AuthContext';
import { animalsAPI, badgesAPI, donationsAPI, UserAnimal, Animal } from '../services/api';
import { getAnimalImage } from '../assets/animals';
import { Analytics } from '../services/analytics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

// Emoji representations for animals (synced with backend - 30 animals)
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
  'Avahi': '🐒',
  'Blue Whale': '🐋',
  'Gray Bat': '🦇',
  'Grey Parrot': '🦜',
  'Grizzly Bear': '🐻',
  'Mountain Zebra': '🦓',
  'Pangolin': '🦔',
  'Seal': '🦭',
  'Wombat': '🐻',
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
  'Least Concern': { color: '#5E7F6E', description: 'Population is stable and widespread' },
  'Near Threatened': { color: '#A9BDAF', description: 'May become endangered in the near future' },
  'Vulnerable': { color: '#3B5466', description: 'High risk of extinction in the wild' },
  'Endangered': { color: '#B85C4A', description: 'Very high risk of extinction in the wild' },
  'Critically Endangered': { color: '#B85C4A', description: 'Extremely high risk of extinction' },
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
        <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.primaryLight} />
        </SvgLinearGradient>
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
  const animalSize = 80;
  const minGap = 10;
  const padding = 10;
  const usableW = containerW - padding * 2;
  const maxBottom = containerH * 0.75;

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
    const scale = 1;

    positions.push({ left, bottom, scale });
  }
  return positions;
};

const PURCHASED_ITEMS_PREFIX = 'endura_purchased_items_';
const ASSIGNMENTS_PREFIX = 'endura_item_assignments_';

interface ItemAssignment {
  itemId: string;
  x: number;
  y: number;
  page?: number;
}

interface DraggableItemProps {
  itemId: string;
  image: ImageSourcePropType;
  startX: number;
  startY: number;
  size?: number;
  onDrop: (itemId: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const DraggableItem = ({ itemId, image, startX, startY, size, onDrop, onDragStart, onDragEnd }: DraggableItemProps) => {
  const currentPos = useRef({ x: startX, y: startY });
  const panX = useRef(new Animated.Value(startX)).current;
  const panY = useRef(new Animated.Value(startY)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastGesture = useRef({ dx: 0, dy: 0 });
  const hasBeenDragged = useRef(false);

  const onDropRef = useRef(onDrop);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  onDropRef.current = onDrop;
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  React.useEffect(() => {
    if (!hasBeenDragged.current) {
      currentPos.current = { x: startX, y: startY };
      panX.setValue(startX);
      panY.setValue(startY);
    }
  }, [startX, startY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        lastGesture.current = { dx: 0, dy: 0 };
        onDragStartRef.current?.();
        Animated.spring(scaleAnim, { toValue: 1.15, friction: 6, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_, gesture) => {
        lastGesture.current = { dx: gesture.dx, dy: gesture.dy };
        panX.setValue(currentPos.current.x + gesture.dx);
        panY.setValue(currentPos.current.y + gesture.dy);
      },
      onPanResponderRelease: () => {
        hasBeenDragged.current = true;
        const finalX = currentPos.current.x + lastGesture.current.dx;
        const finalY = currentPos.current.y + lastGesture.current.dy;
        currentPos.current = { x: finalX, y: finalY };
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: false }).start();
        onDragEndRef.current?.();
        onDropRef.current(itemId, finalX, finalY);
      },
      onPanResponderTerminate: () => {
        onDragEndRef.current?.();
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: false }).start();
      },
    })
  ).current;

  const s = size || 24;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableItem,
        {
          width: s + 4,
          height: s + 4,
          transform: [
            { translateX: panX },
            { translateY: panY },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Image source={image} style={{ width: s, height: s }} resizeMode="contain" />
    </Animated.View>
  );
};

const getBaseItemId = (instanceId: string): string => {
  const parts = instanceId.split('__');
  return parts[0];
};

const getShopImage = (instanceId: string): any => {
  return SHOP_IMAGES[getBaseItemId(instanceId)];
};

const SHOP_IMAGES: Record<string, any> = {
  acc_tophat: require('../assets/shop/accessories/tophat.png'),
  acc_sunnies: require('../assets/shop/accessories/sunnies.png'),
  acc_crown: require('../assets/shop/accessories/crown.png'),
  acc_gradcap: require('../assets/shop/accessories/gradcap.png'),
  acc_eyemask: require('../assets/shop/accessories/eyemask.png'),
  acc_partyhat: require('../assets/shop/accessories/partyhat.png'),
  acc_halo: require('../assets/shop/accessories/halo.png'),
  acc_bow: require('../assets/shop/accessories/bow.png'),
  dec_daisy: require('../assets/shop/decorations/daisy.png'),
  dec_mushroom: require('../assets/shop/decorations/mushroom.png'),
  dec_tree: require('../assets/shop/decorations/tree.png'),
  dec_tulips: require('../assets/shop/decorations/tulips.png'),
  dec_stones: require('../assets/shop/decorations/stones.png'),
  dec_bamboo: require('../assets/shop/decorations/bamboo.png'),
};

export default function CollectionScreen() {
  const navigation = useNavigation<any>();
  const { profilePic, user } = useAuth();
  const purchasedKey = `${PURCHASED_ITEMS_PREFIX}${user?.id || 'anon'}`;
  const assignmentsKey = `${ASSIGNMENTS_PREFIX}${user?.id || 'anon'}`;
  const [myAnimals, setMyAnimals] = useState<UserAnimal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<UserAnimal | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSanctuaryModal, setShowSanctuaryModal] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, number>>({});
  const [itemAssignments, setItemAssignments] = useState<ItemAssignment[]>([]);
  const itemAssignmentsRef = useRef<ItemAssignment[]>([]);
  const [sanctuaryContentH, setSanctuaryContentH] = useState(0);
  const sanctuaryContentHRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [sanctuaryPage, setSanctuaryPage] = useState(0);
  const [traySlotOrigin, setTraySlotOrigin] = useState({ x: 0, y: 0 });
  const [showInstancePicker, setShowInstancePicker] = useState(false);
  const [instancePickerAnimals, setInstancePickerAnimals] = useState<UserAnimal[]>([]);
  const traySlotOriginRef = useRef({ x: 0, y: 0 });
  const [communityTotal, setCommunityTotal] = useState(0);
  const loadPurchases = async () => {
    try {
      const raw = await AsyncStorage.getItem(purchasedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated: Record<string, number> = {};
        for (const [key, val] of Object.entries(parsed)) {
          migrated[key] = typeof val === 'number' ? (val as number) : (val ? 1 : 0);
        }
        setPurchasedItems(migrated);
      } else {
        setPurchasedItems({});
      }
    } catch (e) {}
  };

  const loadAssignments = async () => {
    try {
      const raw = await AsyncStorage.getItem(assignmentsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const valid = Array.isArray(parsed)
          ? parsed.filter((a: any) => a.itemId && typeof a.x === 'number' && typeof a.y === 'number')
          : [];
        itemAssignmentsRef.current = valid;
        setItemAssignments(valid);
        if (valid.length !== parsed.length) {
          await AsyncStorage.setItem(assignmentsKey, JSON.stringify(valid));
        }
      } else {
        itemAssignmentsRef.current = [];
        setItemAssignments([]);
      }
    } catch (e) {
      await AsyncStorage.removeItem(assignmentsKey);
    }
  };

  const sanctuaryPageRef = useRef(0);
  useEffect(() => { sanctuaryPageRef.current = sanctuaryPage; }, [sanctuaryPage]);

  const handleItemDrop = useCallback(async (itemId: string, x: number, y: number) => {
    const filtered = itemAssignmentsRef.current.filter(a => a.itemId !== itemId);
    const trayTop = traySlotOriginRef.current.y - 10;
    if (y >= trayTop) {
      itemAssignmentsRef.current = filtered;
      setItemAssignments(filtered);
      await AsyncStorage.setItem(assignmentsKey, JSON.stringify(filtered));
    } else {
      const updated = [...filtered, { itemId, x, y, page: sanctuaryPageRef.current }];
      itemAssignmentsRef.current = updated;
      setItemAssignments(updated);
      await AsyncStorage.setItem(assignmentsKey, JSON.stringify(updated));
    }
  }, [assignmentsKey]);

  const removeAssignment = async (itemId: string) => {
    const updated = itemAssignmentsRef.current.filter(a => a.itemId !== itemId);
    itemAssignmentsRef.current = updated;
    setItemAssignments(updated);
    await AsyncStorage.setItem(assignmentsKey, JSON.stringify(updated));
  };

  const ownedDecorationItems = (() => {
    const all = Object.keys(purchasedItems)
      .filter(id => (purchasedItems[id] || 0) > 0 && SHOP_IMAGES[id])
      .reverse()
      .flatMap(id => {
        const count = purchasedItems[id] || 0;
        return Array.from({ length: count }, (_, i) => ({
          id: i === 0 ? id : `${id}__${i}`,
          image: SHOP_IMAGES[id],
        }));
      });
    const unplaced = all.filter(item => !itemAssignments.some(a => a.itemId === item.id));
    const placed = all.filter(item => itemAssignments.some(a => a.itemId === item.id));
    return [...unplaced, ...placed];
  })();

  const openSanctuary = async () => {
    Analytics.sanctuaryViewed();
    setSanctuaryPage(0);
    await loadPurchases();
    await loadAssignments();
    setShowSanctuaryModal(true);
  };

  const loadData = async () => {
    try {
      loadPurchases();
      loadAssignments();
      const [myData, allData] = await Promise.all([
        animalsAPI.getMyAnimals(),
        animalsAPI.getAllAnimals(),
      ]);
      setMyAnimals(myData);
      setAllAnimals(allData);
    } catch (error) {
      if (__DEV__) console.error('Failed to load animals:', error);
    }
  };

  const fetchCommunityTotal = async () => {
    try {
      const res = await fetch(`${API_URL}/donations/community-stats`);
      if (res.ok) {
        const data = await res.json();
        setCommunityTotal(data.total_raised || 0);
      }
    } catch (e) {}
    
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      fetchCommunityTotal();
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

  const openAnimalForSpecies = (speciesId: number) => {
    const instances = myAnimals.filter(a => a.animal.id === speciesId);
    if (instances.length <= 1) {
      openAnimalDetail(instances[0]);
    } else {
      setInstancePickerAnimals(instances);
      setShowInstancePicker(true);
    }
  };

  const saveNickname = async () => {
    if (!selectedAnimal || !nicknameInput.trim()) return;
    
    try {
      await animalsAPI.nameAnimal(selectedAnimal.id, nicknameInput.trim());
      await loadData();
      try { await badgesAPI.checkBadges(); } catch {}
      setShowModal(false);
      Alert.alert('Success', `${selectedAnimal.animal.name} is now named "${nicknameInput.trim()}"!`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Count collected animals by id
  const collectedIds = new Set(myAnimals.map((a) => a.animal.id));
  const collectionProgress = collectedIds.size / Math.max(allAnimals.length, 1);

  // Group animals: one card per species, with count
  const animalCountMap = new Map<number, { userAnimal: UserAnimal; count: number }>();
  for (const ua of myAnimals) {
    const existing = animalCountMap.get(ua.animal.id);
    if (existing) {
      existing.count += 1;
      if (new Date(ua.hatched_at) > new Date(existing.userAnimal.hatched_at)) {
        existing.userAnimal = ua;
      }
    } else {
      animalCountMap.set(ua.animal.id, { userAnimal: ua, count: 1 });
    }
  }
  const groupedAnimals = Array.from(animalCountMap.values());

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
          <Text style={styles.titleBlack}>My Sanctuary</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.profileButtonImage} />
              ) : (
                <Text style={styles.profileButtonEmoji}>👤</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Take Action CTA */}
        <TouchableOpacity
          style={styles.takeActionWrap}
          onPress={() => navigation.navigate('TakeAction')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7BB5AD', '#2D4055']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.takeActionBtn}
          >
            <Text style={styles.takeActionEmoji}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.takeActionTitle}>Take Action — Save Endangered Species</Text>
              <Text style={styles.takeActionSub}>
                {communityTotal > 0
                  ? `$${communityTotal.toFixed(0)} raised by our community`
                  : 'Donate to WWF and make a real difference'}
              </Text>
            </View>
            <Text style={styles.takeActionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <LinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statNumber}>{myAnimals.length}</Text>
            <Text style={styles.statLabel}>Animals</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.statCard}
          >
            <Text style={styles.statNumber}>{Math.round(collectionProgress * 100)}%</Text>
            <Text style={styles.statLabel}>of all animals hatched</Text>
          </LinearGradient>
        </View>

        {/* Animal Sanctuary */}
        {myAnimals.length > 0 && (() => {
          const previewW = SCREEN_WIDTH - spacing.lg * 2;
          const previewH = 200;
          const previewPositions = generatePositions(Math.min(myAnimals.length, 6), previewW, previewH);
          return (
            <View style={styles.sanctuarySection}>
              <Text style={styles.sanctuaryTitle}>🌿 My Animal Sanctuary</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={openSanctuary}
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
                  <View style={styles.sanctuaryAnimals}>
                    {myAnimals.slice(0, 6).map((userAnimal, index) => {
                      const imageSource = getAnimalImage(userAnimal.animal.name);
                      const pos = previewPositions[index];
                      return (
                        <View
                          key={userAnimal.id}
                          style={[
                            styles.sanctuaryAnimal,
                            { bottom: pos.bottom - 15, left: pos.left, transform: [{ scale: pos.scale }] },
                          ]}
                        >
                          {imageSource ? (
                            <Image source={imageSource} style={styles.sanctuaryAnimalImage} resizeMode="contain" />
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
                  {myAnimals.length > 6 && (
                    <View style={styles.sanctuaryMoreBadge}>
                      <Text style={styles.sanctuaryMoreText}>+{myAnimals.length - 6} more</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openSanctuary}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.viewSanctuaryBtn}
                >
                  <Text style={styles.viewSanctuaryBtnEmoji}>🏞️</Text>
                  <Text style={styles.viewSanctuaryBtnTextWhite}>View Whole Sanctuary</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.sanctuaryClickHint}>tap to view animals wearing accessories</Text>

              {/* Shop Entry */}
              <TouchableOpacity
                style={styles.shopEntryBtn}
                onPress={() => navigation.navigate('Shop')}
                activeOpacity={0.8}
              >
                <Text style={styles.shopEntryEmoji}>🛒</Text>
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
            <Text style={styles.countText}>
              {collectedIds.size} species{myAnimals.length > collectedIds.size ? ` · ${myAnimals.length} total` : ''}
            </Text>
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
            {groupedAnimals.map(({ userAnimal, count }) => {
              const imageSource = getAnimalImage(userAnimal.animal.name);
              return (
                <TouchableOpacity
                  key={userAnimal.animal.id}
                  style={styles.animalCard}
                  onPress={() => openAnimalForSpecies(userAnimal.animal.id)}
                >
                  <View>
                    {imageSource ? (
                      <Image source={imageSource} style={styles.animalImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.animalEmoji}>
                        {animalEmojis[userAnimal.animal.name] || '🦁'}
                      </Text>
                    )}
                    {count > 1 && (
                      <View style={styles.animalCountBadge}>
                        <Text style={styles.animalCountText}>x{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.animalName} numberOfLines={2}>
                    {userAnimal.nickname || userAnimal.animal.name}
                  </Text>
                  {userAnimal.shared_with_username ? (
                    <Text style={styles.sharedWithLabel}>💚 with {userAnimal.shared_with_username}</Text>
                  ) : (
                    <Text style={styles.tapToNickname}>tap to nickname</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        
      </ScrollView>

      {/* Animal Detail Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <LinearGradient
              colors={['#FFFFFF', '#E7EFEA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.modalContent, { flex: 1, minHeight: '100%' }]}
            >
              <DragHandle />
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
                        resizeMode="contain"
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
                  <LinearGradient
                    colors={['rgba(168, 200, 216, 0.2)', '#E7EFEA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.funFactSection}
                  >
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>💡</Text>
                      <Text style={styles.infoSectionTitle}>Fun Fact</Text>
                    </View>
                    <Text style={styles.funFactText}>
                      {animalDetails[selectedAnimal.animal.name]?.funFact || 
                        selectedAnimal.animal.description || 
                        'This amazing creature is part of your collection!'}
                    </Text>
                  </LinearGradient>

                </>
              )}
            </LinearGradient>
          </ScrollView>
        </View>
      </Modal>

      {/* Full Sanctuary Modal */}
      <Modal visible={showSanctuaryModal} transparent animationType="fade">
        <TouchableOpacity style={styles.sanctuaryModalOverlay} activeOpacity={1} onPress={() => setShowSanctuaryModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sanctuaryModalContent}>
            {/* Header */}
            <View
              style={[styles.sanctuaryModalHeader, { backgroundColor: '#FFFFFF' }]}
            >
              <View>
                <Text style={styles.sanctuaryModalTitle}>🌿 My Sanctuary</Text>
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

            {/* Paginated sanctuary scenes */}
            {(() => {
              const ANIMALS_PER_PAGE = 12;
              const containerW = SCREEN_WIDTH - 20;
              const totalPages = Math.max(1, Math.ceil(myAnimals.length / ANIMALS_PER_PAGE));
              const pages: UserAnimal[][] = [];
              for (let p = 0; p < totalPages; p++) {
                pages.push(myAnimals.slice(p * ANIMALS_PER_PAGE, (p + 1) * ANIMALS_PER_PAGE));
              }
              const modalW = containerW - spacing.sm * 2;
              const currentPageAnimals = pages[sanctuaryPage] || pages[0];
              const cols = Math.max(2, Math.min(4, Math.floor((modalW - 20) / (62 + 10))));
              const maxRows = Math.ceil(ANIMALS_PER_PAGE / cols);
              const sceneH = Math.max(SCREEN_HEIGHT * 0.55, maxRows * 80 + 80);

              return (
                <View style={{ flex: 1 }}>
                  <ScrollView
                    style={styles.sanctuaryScroll}
                    contentContainerStyle={styles.sanctuaryScrollContent}
                    scrollEnabled={!isDragging}
                    showsVerticalScrollIndicator={true}
                    bounces={false}
                  >
                    <View
                      style={styles.sanctuaryDragWrapper}
                      onLayout={(e: LayoutChangeEvent) => {
                        const h = e.nativeEvent.layout.height;
                        sanctuaryContentHRef.current = h;
                        if (sanctuaryContentH === 0 || Math.abs(h - sanctuaryContentH) > 5) {
                          setSanctuaryContentH(h);
                        }
                      }}
                    >
                      <View style={[styles.sanctuaryModalScene, { height: sceneH }]}>
                        <View style={styles.sanctuaryModalLandscapeBg}>
                          <LottieView
                            source={require('../assets/nature-landscape.json')}
                            autoPlay
                            loop
                            style={styles.sanctuaryModalLottie}
                            resizeMode="cover"
                          />
                        </View>

                        <View style={styles.sanctuaryModalAnimals}>
                          {(() => {
                            const positions = generatePositions(currentPageAnimals.length, modalW, sceneH);
                            return currentPageAnimals.map((userAnimal, index) => {
                              const imageSource = getAnimalImage(userAnimal.animal.name);
                              const pos = positions[index];
                              return (
                                <View
                                  key={userAnimal.id}
                                  style={[
                                    styles.sanctuaryModalAnimal,
                                    { bottom: pos.bottom, left: pos.left, transform: [{ scale: pos.scale }] },
                                  ]}
                                >
                                  {imageSource ? (
                                    <Image source={imageSource} style={styles.sanctuaryModalAnimalImg} resizeMode="contain" />
                                  ) : (
                                    <Text style={styles.sanctuaryModalAnimalEmoji}>
                                      {animalEmojis[userAnimal.animal.name] || '🦁'}
                                    </Text>
                                  )}
                                  <View style={styles.sanctuaryModalNameTag}>
                                    <Text style={styles.sanctuaryModalNameText} numberOfLines={1}>
                                      {userAnimal.shared_with_username ? '💚 ' : ''}{userAnimal.nickname || userAnimal.animal.name.split(' ').pop()}
                                    </Text>
                                  </View>
                                </View>
                              );
                            });
                          })()}
                        </View>

                        <View style={styles.sanctuaryModalGround} />
                      </View>

                      {/* Page switcher */}
                      {totalPages > 1 && (
                        <View style={styles.sanctuaryPageSwitcher}>
                          <TouchableOpacity
                            style={[styles.sanctuaryPageArrow, sanctuaryPage === 0 && styles.sanctuaryPageArrowDisabled]}
                            onPress={() => sanctuaryPage > 0 && setSanctuaryPage(sanctuaryPage - 1)}
                            disabled={sanctuaryPage === 0}
                          >
                            <Text style={[styles.sanctuaryPageArrowText, sanctuaryPage === 0 && { color: 'rgba(95,140,135,0.4)' }]}>‹</Text>
                          </TouchableOpacity>
                          <View style={styles.sanctuaryPageDots}>
                            {pages.map((_, i) => (
                              <TouchableOpacity key={i} onPress={() => setSanctuaryPage(i)}>
                                <View
                                  style={[
                                    styles.sanctuaryPageDot,
                                    i === sanctuaryPage && styles.sanctuaryPageDotActive,
                                  ]}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            style={[styles.sanctuaryPageArrow, sanctuaryPage === totalPages - 1 && styles.sanctuaryPageArrowDisabled]}
                            onPress={() => sanctuaryPage < totalPages - 1 && setSanctuaryPage(sanctuaryPage + 1)}
                            disabled={sanctuaryPage === totalPages - 1}
                          >
                            <Text style={[styles.sanctuaryPageArrowText, sanctuaryPage === totalPages - 1 && { color: 'rgba(95,140,135,0.4)' }]}>›</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Item tray — inside wrapper so coordinates match */}
                      {ownedDecorationItems.length > 0 && (
                        <View
                          style={styles.itemTrayFooter}
                          onLayout={(e: LayoutChangeEvent) => {
                            const footerY = e.nativeEvent.layout.y;
                            const footerX = e.nativeEvent.layout.x;
                            const paddingTop = 10;
                            const labelH = 11 + 8;
                            const slotY = footerY + paddingTop + labelH;
                            const slotX = footerX + spacing.md;
                            const origin = { x: slotX, y: slotY };
                            traySlotOriginRef.current = origin;
                            setTraySlotOrigin(origin);
                          }}
                        >
                          <Text style={styles.itemTrayLabel}>Drag items!</Text>
                          <View style={styles.itemTrayRow}>
                            {ownedDecorationItems.filter(item => !itemAssignments.some(a => a.itemId === item.id)).map((item) => (
                              <View key={item.id} style={[styles.itemTraySlot, styles.itemTraySlotReady]} />
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Draggable items — unplaced spawn in their tray slot, placed spawn at saved position */}
                      {traySlotOrigin.y > 0 && (() => {
                        const unplacedItems = ownedDecorationItems.filter(
                          item => !itemAssignments.some(a => a.itemId === item.id)
                        );
                        const thisPagePlaced = ownedDecorationItems.filter(
                          item => itemAssignments.some(a => a.itemId === item.id && (a.page ?? 0) === sanctuaryPage)
                        );
                        const draggableItems = [...unplacedItems, ...thisPagePlaced];
                        const slotW = 44;
                        const slotGap = 6;

                        return draggableItems.map((item) => {
                          const existing = itemAssignments.find(a => a.itemId === item.id && (a.page ?? 0) === sanctuaryPage);
                          const baseId = getBaseItemId(item.id);
                          const isDecoration = baseId.startsWith('dec_');
                          const itemSize = isDecoration ? 58 : baseId === 'acc_gradcap' ? 40 : 26;

                          let spawnX: number;
                          let spawnY: number;
                          if (existing) {
                            spawnX = existing.x;
                            spawnY = existing.y;
                          } else {
                            const unplacedIdx = unplacedItems.findIndex(d => d.id === item.id);
                            const slotCenterX = traySlotOriginRef.current.x + unplacedIdx * (slotW + slotGap) + slotW / 2;
                            const slotCenterY = traySlotOriginRef.current.y + slotW / 2;
                            spawnX = slotCenterX - itemSize / 2;
                            spawnY = slotCenterY - itemSize / 2;
                          }
                          return (
                            <DraggableItem
                              key={`${item.id}_p${sanctuaryPage}`}
                              itemId={item.id}
                              image={item.image}
                              size={itemSize}
                              startX={spawnX}
                              startY={spawnY}
                              onDrop={handleItemDrop}
                              onDragStart={() => { setIsDragging(true); setDraggingItemId(item.id); }}
                              onDragEnd={() => { setIsDragging(false); setDraggingItemId(null); }}
                            />
                          );
                        });
                      })()}
                    </View>
                  </ScrollView>
                </View>
              );
            })()}

            {/* Footer */}
            <View style={styles.sanctuaryModalFooter}>
              <TouchableOpacity
                onPress={() => setShowSanctuaryModal(false)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sanctuaryModalDoneBtn}
                >
                  <Text style={styles.sanctuaryModalDoneBtnText}>Close Sanctuary</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Instance Picker Modal */}
      <Modal visible={showInstancePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInstancePicker(false)}>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={['#FFFFFF', '#E7EFEA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ flex: 1 }}
          >
            <DragHandle />
            <View style={styles.instancePickerHeader}>
              <Text style={styles.instancePickerTitle} numberOfLines={1}>
                Choose a {instancePickerAnimals[0]?.animal.name || 'Animal'}
              </Text>
              <TouchableOpacity onPress={() => setShowInstancePicker(false)} style={styles.instancePickerClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.instancePickerSubtitle}>
              You have {instancePickerAnimals.length} — tap one to view or nickname
            </Text>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}>
              {instancePickerAnimals.map((ua, idx) => {
                const img = getAnimalImage(ua.animal.name);
                return (
                  <TouchableOpacity
                    key={ua.id}
                    style={styles.instanceRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowInstancePicker(false);
                      setTimeout(() => openAnimalDetail(ua), 300);
                    }}
                  >
                    {img ? (
                      <Image source={img} style={styles.instanceImage} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: 32 }}>{animalEmojis[ua.animal.name] || '🦁'}</Text>
                    )}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.instanceName}>
                        {ua.nickname || `${ua.animal.name} #${idx + 1}`}
                      </Text>
                      <Text style={styles.instanceSub}>
                        {ua.nickname ? ua.animal.name : 'No nickname yet'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, color: colors.textMuted }}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </LinearGradient>
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
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleWhite: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  titleBlack: {
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
  profileButtonImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 1,
  },
  takeActionWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowColor: '#2F4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  takeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  takeActionEmoji: {
    fontSize: 28,
  },
  takeActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  takeActionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 3,
  },
  takeActionArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  progressCard: {
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  progressLeft: {
    position: 'relative',
    marginRight: 10,
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
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  progressRight: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sanctuarySection: {
    marginBottom: spacing.md,
  },
  sanctuaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sanctuaryContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E7EFEA',
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
    height: 300,
    position: 'absolute',
    top: -80,
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
    width: 70,
    height: 70,
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
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
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
  viewSanctuaryBtnTextWhite: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sanctuaryClickHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  sanctuaryCaption: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  // Full Sanctuary Modal
  sanctuaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 44,
    paddingBottom: 24,
  },
  sanctuaryModalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  sanctuaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  sanctuaryScroll: {
    flex: 1,
  },
  sanctuaryScrollContent: {
    flexGrow: 1,
  },
  sanctuaryDragWrapper: {
    position: 'relative',
  },
  sanctuaryModalScene: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#A9BDAF',
    marginHorizontal: spacing.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    height: '170%',
    position: 'absolute',
    top: '-70%' as any,
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
    width: 74,
    height: 74,
  },
  sanctuaryModalAnimalEmoji: {
    fontSize: 36,
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
  decorationImg: {
    position: 'absolute',
    width: 42,
    height: 42,
  },
  decorationRowPreview: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 3,
  },
  decorationImgPreview: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  shopEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
  },
  shopEntryEmoji: {
    fontSize: 30,
  },
  shopEntryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shopEntrySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  shopEntryArrow: {
    fontSize: 28,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  sanctuaryPageSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
    marginHorizontal: spacing.sm,
  },
  sanctuaryPageArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5F8C87',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2F4A3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sanctuaryPageArrowDisabled: {
    backgroundColor: 'rgba(95,140,135,0.15)',
    shadowOpacity: 0,
    elevation: 0,
  },
  sanctuaryPageArrowText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
  sanctuaryPageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  sanctuaryPageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  sanctuaryPageDotActive: {
    backgroundColor: '#5F8C87',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sanctuaryModalFooter: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sanctuaryModalFooterText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  sanctuaryModalDoneBtn: {
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
  placedItemPreview: {
    width: 20,
    height: 20,
    position: 'absolute',
    zIndex: 10,
  },
  draggableItem: {
    position: 'absolute',
    zIndex: 100,
    width: 28,
    height: 28,
  },
  draggableItemImg: {
    width: 24,
    height: 24,
  },
  itemTrayFooter: {
    backgroundColor: '#FFFFFFEE',
    marginHorizontal: spacing.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder + '60',
  },
  itemTrayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  itemTrayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
  },
  itemTraySlot: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.cardBorder + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder + '50',
    borderStyle: 'dashed' as any,
  },
  itemTraySlotReady: {
    borderStyle: 'solid' as any,
    borderColor: colors.primary + '40',
    backgroundColor: colors.surface,
  },
  itemTraySlotPlaced: {
    borderColor: colors.cardBorder + '30',
    backgroundColor: 'transparent',
    opacity: 0.35,
  },
  itemTraySlotImg: {
    width: 30,
    height: 30,
    opacity: 0.25,
  },
  itemTraySlotImgFull: {
    opacity: 1,
  },
  itemTrayItem: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  itemTrayItemAssigned: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  itemTrayImg: {
    width: 34,
    height: 34,
  },
  itemTrayCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTrayCheckText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    marginLeft: spacing.sm,
    backgroundColor: '#FFFFFF',
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
  animalCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  animalCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tapToNickname: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  sharedWithLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
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
  instancePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  instancePickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  instancePickerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  instancePickerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  instanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.small,
  },
  instanceImage: {
    width: 52,
    height: 52,
  },
  instanceName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  instanceSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
