import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

// Admin password (change this!)
const ADMIN_PASSWORD = 'endura2024';

interface Animal {
  id: number;
  name: string;
  emoji: string;
  status: string;
  habitat?: string;
  funFact?: string;
}

// Local animal data that can be edited
const DEFAULT_ANIMALS: Animal[] = [
  { id: 1, name: 'Red Panda', emoji: '🐼', status: 'Endangered', habitat: 'Himalayan forests', funFact: 'Red pandas spend most of their lives in trees.' },
  { id: 2, name: 'Sea Turtle', emoji: '🐢', status: 'Endangered', habitat: 'Tropical oceans', funFact: 'Sea turtles can hold their breath for 5 hours.' },
  { id: 3, name: 'Penguin', emoji: '🐧', status: 'Vulnerable', habitat: 'Antarctic coasts', funFact: 'Emperor penguins can dive 1,800 feet deep.' },
  { id: 4, name: 'Koala', emoji: '🐨', status: 'Vulnerable', habitat: 'Australian eucalyptus forests', funFact: 'Koalas sleep up to 22 hours a day.' },
  { id: 5, name: 'Flamingo', emoji: '🦩', status: 'Least Concern', habitat: 'Wetlands and lagoons', funFact: 'Flamingos are born grey and turn pink from their diet.' },
  { id: 6, name: 'Giant Panda', emoji: '🐼', status: 'Vulnerable', habitat: 'Chinese bamboo forests', funFact: 'Pandas eat up to 38kg of bamboo daily.' },
  { id: 7, name: 'Snow Leopard', emoji: '🐆', status: 'Vulnerable', habitat: 'Central Asian mountains', funFact: 'Snow leopards can leap 50 feet in a single bound.' },
  { id: 8, name: 'Orangutan', emoji: '🦧', status: 'Critically Endangered', habitat: 'Borneo rainforests', funFact: 'Orangutans share 97% of their DNA with humans.' },
  { id: 9, name: 'Elephant', emoji: '🐘', status: 'Endangered', habitat: 'African savannas', funFact: 'Elephants can recognize themselves in mirrors.' },
  { id: 10, name: 'Polar Bear', emoji: '🐻‍❄️', status: 'Vulnerable', habitat: 'Arctic sea ice', funFact: 'Polar bear fur is actually transparent, not white.' },
  { id: 11, name: 'Tiger', emoji: '🐅', status: 'Endangered', habitat: 'Asian forests', funFact: 'No two tigers have the same stripe pattern.' },
  { id: 12, name: 'Gorilla', emoji: '🦍', status: 'Critically Endangered', habitat: 'African rainforests', funFact: 'Gorillas can learn sign language.' },
  { id: 13, name: 'Blue Whale', emoji: '🐋', status: 'Endangered', habitat: 'All oceans', funFact: 'Blue whale hearts weigh as much as a car.' },
  { id: 14, name: 'Cheetah', emoji: '🐆', status: 'Vulnerable', habitat: 'African grasslands', funFact: 'Cheetahs can accelerate faster than most sports cars.' },
  { id: 15, name: 'Rhinoceros', emoji: '🦏', status: 'Critically Endangered', habitat: 'African and Asian grasslands', funFact: 'Rhino horns are made of keratin, like fingernails.' },
  { id: 16, name: 'Amur Leopard', emoji: '🐆', status: 'Critically Endangered', habitat: 'Russian Far East', funFact: 'Fewer than 100 Amur leopards remain in the wild.' },
  { id: 17, name: 'Vaquita', emoji: '🐬', status: 'Critically Endangered', habitat: 'Gulf of California', funFact: 'Vaquitas are the world\'s smallest porpoise.' },
  { id: 18, name: 'Sumatran Rhino', emoji: '🦏', status: 'Critically Endangered', habitat: 'Indonesian rainforests', funFact: 'Sumatran rhinos are the smallest rhino species.' },
  { id: 19, name: 'Kakapo', emoji: '🦜', status: 'Critically Endangered', habitat: 'New Zealand islands', funFact: 'Kakapos are the only flightless parrots.' },
  { id: 20, name: 'Axolotl', emoji: '🦎', status: 'Critically Endangered', habitat: 'Mexican lakes', funFact: 'Axolotls can regenerate entire limbs.' },
  { id: 21, name: 'Saola', emoji: '🦌', status: 'Critically Endangered', habitat: 'Vietnamese forests', funFact: 'Saolas are so rare they\'re called Asian unicorns.' },
];

export default function AdminScreen() {
  const { user } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [animals, setAnimals] = useState<Animal[]>(DEFAULT_ANIMALS);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPassword('');
    } else {
      Alert.alert('Error', 'Invalid admin password');
    }
  };

  const handleEditAnimal = (animal: Animal) => {
    setEditingAnimal({ ...animal });
    setShowEditModal(true);
  };

  const handleSaveAnimal = () => {
    if (!editingAnimal) return;
    
    setAnimals(prev => 
      prev.map(a => a.id === editingAnimal.id ? editingAnimal : a)
    );
    setShowEditModal(false);
    setEditingAnimal(null);
    Alert.alert('Success', 'Animal updated successfully!');
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>🔐 Admin Access</Text>
          <Text style={styles.loginSubtitle}>
            Enter the admin password to manage content
          </Text>
          
          <TextInput
            style={styles.passwordInput}
            placeholder="Admin Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Access Admin Panel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🛠️ Admin Panel</Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => setIsAuthenticated(false)}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>📊 Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{animals.length}</Text>
              <Text style={styles.statLabel}>Animals</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>21</Text>
              <Text style={styles.statLabel}>Total Slots</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Active</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        </View>

        {/* Animals Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🦁 Manage Animals</Text>
          <Text style={styles.sectionSubtitle}>
            Tap an animal to edit its details
          </Text>
          
          {animals.map((animal) => (
            <TouchableOpacity
              key={animal.id}
              style={styles.animalCard}
              onPress={() => handleEditAnimal(animal)}
            >
              <View style={styles.animalInfo}>
                <Text style={styles.animalEmoji}>{animal.emoji}</Text>
                <View style={styles.animalDetails}>
                  <Text style={styles.animalName}>{animal.name}</Text>
                  <Text style={styles.animalStatus}>{animal.status}</Text>
                </View>
              </View>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Future Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Coming Soon</Text>
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonItem}>• Upload custom animal images</Text>
            <Text style={styles.comingSoonItem}>• Manage Lottie animations</Text>
            <Text style={styles.comingSoonItem}>• Edit study tips</Text>
            <Text style={styles.comingSoonItem}>• User analytics dashboard</Text>
            <Text style={styles.comingSoonItem}>• Push notification management</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Animal Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editingAnimal?.emoji} {editingAnimal?.name}
            </Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editingAnimal?.name || ''}
              onChangeText={(text) => setEditingAnimal(prev => prev ? {...prev, name: text} : null)}
              placeholder="Animal name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Emoji</Text>
            <TextInput
              style={styles.input}
              value={editingAnimal?.emoji || ''}
              onChangeText={(text) => setEditingAnimal(prev => prev ? {...prev, emoji: text} : null)}
              placeholder="🐾"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Conservation Status</Text>
            <TextInput
              style={styles.input}
              value={editingAnimal?.status || ''}
              onChangeText={(text) => setEditingAnimal(prev => prev ? {...prev, status: text} : null)}
              placeholder="Endangered"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Habitat</Text>
            <TextInput
              style={styles.input}
              value={editingAnimal?.habitat || ''}
              onChangeText={(text) => setEditingAnimal(prev => prev ? {...prev, habitat: text} : null)}
              placeholder="Natural habitat"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Fun Fact</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editingAnimal?.funFact || ''}
              onChangeText={(text) => setEditingAnimal(prev => prev ? {...prev, funFact: text} : null)}
              placeholder="Interesting fact about this animal"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingAnimal(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveAnimal}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  logoutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + '20',
  },
  logoutText: {
    color: colors.error,
    fontWeight: '600',
  },
  // Login styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  loginSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  passwordInput: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.small,
  },
  loginButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Stats
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Animal cards
  animalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  animalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  animalEmoji: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  animalDetails: {
    flex: 1,
  },
  animalName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  animalStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editIcon: {
    fontSize: 20,
  },
  // Coming soon
  comingSoonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.small,
  },
  comingSoonItem: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
});
