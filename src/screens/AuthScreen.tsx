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
import {
  USER_CATEGORY_LABELS_FR,
  USER_CATEGORY_PRICES_CHF,
  formatChf,
} from '../utils/cafeteriaRules';

export const AuthScreen: React.FC<{ onAuthenticated: () => void }> = ({
  onAuthenticated,
}) => {
  const {
    users,
    currentUser,
    switchDemoUser,
    loginWithPassword,
    registerNewUser,
    resetPasswordForEmail,
    logout,
  } = useCafeteria();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Champs Connexion
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Champs Inscription
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [initialCategory, setInitialCategory] = useState<'adult' | 'student'>('student');
  const [classNumber, setClassNumber] = useState('');

  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleLogin = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    const res = await loginWithPassword(loginEmail, loginPassword);
    setIsSubmitting(false);
    setFeedback({ ok: res.ok, text: res.messageFr });
    if (res.ok) {
      setLoginPassword('');
      setTimeout(() => onAuthenticated(), 600);
    }
  };

  const handleResetPassword = async () => {
    setIsSubmitting(true);
    const res = await resetPasswordForEmail(loginEmail);
    setIsSubmitting(false);
    setFeedback({ ok: res.ok, text: res.messageFr });
  };

  const handleCreateAccount = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    const res = await registerNewUser({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      initialCategory,
      classNumber,
    });
    setIsSubmitting(false);
    setFeedback({ ok: res.ok, text: res.messageFr });
    if (res.ok) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setClassNumber('');
      setTimeout(() => onAuthenticated(), 700);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Carte Principale : Se connecter / Créer un compte avec mot de passe */}
      <View style={styles.card}>
        <View style={styles.modeSwitchRow}>
          <Pressable
            onPress={() => {
              setMode('login');
              setFeedback(null);
            }}
            style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'login' && styles.modeTabTextActive,
              ]}
            >
              🔑 Se connecter
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode('register');
              setFeedback(null);
            }}
            style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
          >
            <Text
              style={[
                styles.modeTabText,
                mode === 'register' && styles.modeTabTextActive,
              ]}
            >
              ✨ Créer un compte
            </Text>
          </Pressable>
        </View>

        {mode === 'login' ? (
          <View>
            <Text style={styles.sectionTitle}>Connexion à votre compte</Text>
            <Text style={styles.subtitle}>
              Accédez à vos réservations, vos codes QR personnels et au paiement Twint avec votre
              adresse e-mail et votre mot de passe.
            </Text>

            <Text style={styles.label}>Adresse e-mail *</Text>
            <TextInput
              style={styles.input}
              placeholder="exemple@voirets.ch"
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
            />

            <Text style={styles.label}>Mot de passe *</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Votre mot de passe"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={loginPassword}
                onChangeText={setLoginPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeBtnText}>
                  {showPassword ? 'Masquer' : 'Afficher'}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={handleResetPassword} style={styles.forgotLinkBtn}>
              <Text style={styles.forgotLinkText}>Mot de passe oublié ?</Text>
            </Pressable>

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
                    color: feedback.ok
                      ? stitchTheme.colors.primaryDark
                      : stitchTheme.colors.danger,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              onPress={handleLogin}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Créer un compte utilisateur</Text>
            <Text style={styles.subtitle}>
              Choisissez entre Élève ou Adulte. Les subventions élèves (4.00 CHF ou 0.00 CHF) sont
              autorisées par l’administrateur.
            </Text>

            {/* Choix entre Élève (8 CHF) et Adulte (10 CHF) */}
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
                  🎓 Élève
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
                  👤 Adulte
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
                <Text style={styles.label}>
                  Numéro de la classe * (obligatoire pour les élèves)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 10VG-3"
                  value={classNumber}
                  onChangeText={setClassNumber}
                />
              </>
            )}

            <Text style={styles.label}>Mot de passe * (minimum 6 caractères)</Text>
            <View style={styles.passwordInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Créer un mot de passe"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeBtnText}>
                  {showPassword ? 'Masquer' : 'Afficher'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Confirmer le mot de passe *</Text>
            <TextInput
              style={styles.input}
              placeholder="Répéter le mot de passe"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

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
                    color: feedback.ok
                      ? stitchTheme.colors.primaryDark
                      : stitchTheme.colors.danger,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              disabled={isSubmitting}
              onPress={handleCreateAccount}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Création en cours...' : 'Créer mon compte'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Sélecteur rapide de comptes de test + Déconnexion */}
      <View style={styles.card}>
        <View style={styles.demoHeaderRow}>
          <Text style={styles.sectionTitle}>Comptes de démonstration (Test rapide)</Text>
          {currentUser && (
            <Pressable onPress={logout} style={styles.logoutSmallBtn}>
              <Text style={styles.logoutSmallBtnText}>Se déconnecter</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          Mot de passe configuré dans Supabase Auth pour ces comptes :{' '}
          <Text style={{ fontWeight: '800', color: stitchTheme.colors.primaryDark }}>
            Voirets2026!
          </Text>
        </Text>

        {users.map((u) => {
          const isSelected = currentUser?.id === u.id || currentUser?.email === u.email;
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
                  {u.email} • {USER_CATEGORY_LABELS_FR[u.category]} —{' '}
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
                  {isSelected ? 'Actif' : 'Tester'}
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
    borderRadius: stitchTheme.radius.xl,
    padding: stitchTheme.spacing.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: stitchTheme.colors.surfaceMuted,
    padding: 4,
    borderRadius: stitchTheme.radius.lg,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: stitchTheme.colors.primary,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: stitchTheme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  choiceBtn: {
    flex: 1,
    padding: 12,
    borderRadius: stitchTheme.radius.lg,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.border,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    alignItems: 'center',
  },
  choiceBtnActive: {
    borderColor: stitchTheme.colors.primary,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  choiceTitleActive: { color: stitchTheme.colors.primaryDark },
  choicePrice: { fontSize: 12, color: stitchTheme.colors.textSecondary, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    borderRadius: stitchTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: stitchTheme.colors.textPrimary,
    backgroundColor: '#FFF',
  },
  passwordInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  eyeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
  forgotLinkBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.primary,
  },
  alertBox: {
    padding: 12,
    borderRadius: stitchTheme.radius.md,
    marginTop: 12,
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: stitchTheme.colors.primary,
    paddingVertical: 14,
    borderRadius: stitchTheme.radius.lg,
    alignItems: 'center',
  },
  submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  demoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logoutSmallBtn: {
    backgroundColor: stitchTheme.colors.dangerLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  logoutSmallBtnText: {
    color: stitchTheme.colors.danger,
    fontSize: 11,
    fontWeight: '800',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: stitchTheme.radius.lg,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    marginTop: 8,
  },
  userRowActive: {
    borderColor: stitchTheme.colors.primary,
    backgroundColor: stitchTheme.colors.primarySoft,
  },
  userName: { fontSize: 14, fontWeight: '800', color: stitchTheme.colors.textPrimary },
  userMeta: { fontSize: 12, color: stitchTheme.colors.textSecondary, marginTop: 2 },
  rolesTag: {
    fontSize: 11,
    color: stitchTheme.colors.primaryDark,
    fontWeight: '700',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.surfaceMuted,
  },
  badgeActive: { backgroundColor: stitchTheme.colors.primary },
  badgeText: { fontSize: 11, fontWeight: '800', color: stitchTheme.colors.textPrimary },
});
