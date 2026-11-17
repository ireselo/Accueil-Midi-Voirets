import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCafeteria } from '../context/CafeteriaContext';
import { stitchTheme } from '../theme/stitchTheme';
import { USER_CATEGORY_LABELS_FR, formatChf, USER_CATEGORY_PRICES_CHF } from '../utils/cafeteriaRules';

export const AuthScreen: React.FC<{ onAuthenticated: () => void }> = ({
  onAuthenticated,
}) => {
  const { users, currentUser, switchDemoUser, registerNewUser } = useCafeteria();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [initialCategory, setInitialCategory] = useState<'adult' | 'student'>('student');
  const [classNumber, setClassNumber] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCreateAccount = () => {
    const res = registerNewUser({
      firstName,
      lastName,
      email,
      initialCategory,
      classNumber,
    });
    setFeedback({ ok: res.ok, text: res.messageFr });
    if (res.ok) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setClassNumber('');
      setTimeout(() => onAuthenticated(), 700);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Créer un compte utilisateur</Text>
        <Text style={styles.subtitle}>
          Choisissez votre profil. Les subventions élèves (4.00 CHF ou 0.00 CHF) sont attribuées
          par l’administrateur après inscription.
        </Text>

        {/* Choix entre Adulte (10 CHF) ou Élève (8 CHF) */}
        <Text style={styles.label}>Type d’utilisateur *</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setInitialCategory('student')}
            style={[
              styles.choiceBtn,
              initialCategory === 'student' && styles.choiceBtnActive,
            ]}
          >
            <Text
              style={[
                styles.choiceTitle,
                initialCategory === 'student' && styles.choiceTitleActive,
              ]}
            >
              Élève
            </Text>
            <Text
              style={[
                styles.choicePrice,
                initialCategory === 'student' && styles.choiceTitleActive,
              ]}
            >
              8.00 CHF / repas
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setInitialCategory('adult')}
            style={[
              styles.choiceBtn,
              initialCategory === 'adult' && styles.choiceBtnActive,
            ]}
          >
            <Text
              style={[
                styles.choiceTitle,
                initialCategory === 'adult' && styles.choiceTitleActive,
              ]}
            >
              Adulte
            </Text>
            <Text
              style={[
                styles.choicePrice,
                initialCategory === 'adult' && styles.choiceTitleActive,
              ]}
            >
              10.00 CHF / repas
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Prénom *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Camille"
          value={firstName}
          onChangeText={setFirstName}
        />

        <Text style={styles.label}>Nom de famille *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Rochat"
          value={lastName}
          onChangeText={setLastName}
        />

        <Text style={styles.label}>Adresse e-mail *</Text>
        <TextInput
          style={styles.input}
          placeholder="camille.rochat@ecole.ch"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {initialCategory === 'student' && (
          <>
            <Text style={styles.label}>Numéro de la classe * (obligatoire pour les élèves)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 10VG-3"
              value={classNumber}
              onChangeText={setClassNumber}
            />
          </>
        )}

        {feedback && (
          <View
            style={[
              styles.alertBox,
              {
                backgroundColor: feedback.ok
                  ? stitchTheme.colors.successLight
                  : stitchTheme.colors.dangerLight,
              },
            ]}
          >
            <Text
              style={{
                color: feedback.ok ? stitchTheme.colors.success : stitchTheme.colors.danger,
                fontWeight: '600',
              }}
            >
              {feedback.text}
            </Text>
          </View>
        )}

        <Pressable style={styles.submitBtn} onPress={handleCreateAccount}>
          <Text style={styles.submitBtnText}>S’inscrire à la cafétéria</Text>
        </Pressable>
      </View>

      {/* Sélecteur rapide de comptes pour tester tous les tarifs CHF et rôles */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Changement rapide de compte (Mode Démo)</Text>
        <Text style={styles.subtitle}>
          Testez directement les 4 catégories de tarifs en CHF ainsi que les 5 rôles de gestion :
        </Text>

        {users.map((u) => {
          const isSelected = currentUser?.id === u.id;
          return (
            <Pressable
              key={u.id}
              onPress={() => {
                switchDemoUser(u.id);
                onAuthenticated();
              }}
              style={[styles.userRow, isSelected && styles.userRowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {u.first_name} {u.last_name}{' '}
                  {u.class_number ? `(${u.class_number})` : ''}
                </Text>
                <Text style={styles.userMeta}>
                  {USER_CATEGORY_LABELS_FR[u.category]} —{' '}
                  {formatChf(USER_CATEGORY_PRICES_CHF[u.category])}
                </Text>
                {u.staff_roles.length > 0 && (
                  <Text style={styles.rolesTag}>
                    Rôles cafétéria : {u.staff_roles.join(', ')}
                  </Text>
                )}
              </View>
              <View style={[styles.badge, isSelected && styles.badgeActive]}>
                <Text style={[styles.badgeText, isSelected && { color: '#FFF' }]}>
                  {isSelected ? 'Actif' : 'Choisir'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { padding: stitchTheme.spacing.md, gap: stitchTheme.spacing.md },
  card: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    padding: stitchTheme.spacing.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: stitchTheme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  choiceBtn: {
    flex: 1,
    padding: 12,
    borderRadius: stitchTheme.radius.md,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.border,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    alignItems: 'center',
  },
  choiceBtnActive: {
    borderColor: stitchTheme.colors.primary,
    backgroundColor: stitchTheme.colors.primaryLight,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
  },
  choiceTitleActive: { color: stitchTheme.colors.primaryDark },
  choicePrice: { fontSize: 12, color: stitchTheme.colors.textSecondary, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    borderRadius: stitchTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: stitchTheme.colors.textPrimary,
    backgroundColor: '#FFF',
  },
  alertBox: {
    padding: 12,
    borderRadius: stitchTheme.radius.sm,
    marginTop: 12,
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: stitchTheme.colors.primary,
    paddingVertical: 13,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: stitchTheme.radius.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    marginTop: 8,
  },
  userRowActive: {
    borderColor: stitchTheme.colors.primary,
    backgroundColor: '#F0FDFA',
  },
  userName: { fontSize: 15, fontWeight: '700', color: stitchTheme.colors.textPrimary },
  userMeta: { fontSize: 13, color: stitchTheme.colors.textSecondary, marginTop: 2 },
  rolesTag: {
    fontSize: 12,
    color: stitchTheme.colors.primaryDark,
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.surfaceMuted,
  },
  badgeActive: { backgroundColor: stitchTheme.colors.primary },
  badgeText: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.textPrimary },
});
