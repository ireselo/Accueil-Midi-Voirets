import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { CafeteriaProvider, useCafeteria } from './src/context/CafeteriaContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { MenuBookingScreen } from './src/screens/MenuBookingScreen';
import { ProfileQrScreen } from './src/screens/ProfileQrScreen';
import { StaffDashboardScreen } from './src/screens/StaffDashboardScreen';
import { stitchTheme } from './src/theme/stitchTheme';
import {
  USER_CATEGORY_LABELS_FR,
  USER_CATEGORY_PRICES_CHF,
  formatChf,
} from './src/utils/cafeteriaRules';

type AppTab = 'booking' | 'profile_qr' | 'staff' | 'auth';

const MainShell: React.FC = () => {
  const { settings, currentUser } = useCafeteria();
  const [activeTab, setActiveTab] = useState<AppTab>('booking');

  const isStaffAdult =
    currentUser?.category === 'adult' && currentUser.staff_roles.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Barre supérieure style Stitch (CantineFacile / Table & Récré) */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.logoSquare}>
            <View style={styles.logoSunDot} />
            <Text style={styles.logoEmoji}>🍴</Text>
          </View>
          <View>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.appTitle}>{settings.app_name}</Text>
              <View style={styles.schoolBadge}>
                <Text style={styles.schoolBadgeText}>VOIRETS</Text>
              </View>
            </View>
            <Text style={styles.headerSubLabel}>
              {activeTab === 'booking'
                ? 'INSCRIPTION & MENU'
                : activeTab === 'staff'
                ? 'RÉCEPTION, CUISINE & GESTION'
                : activeTab === 'profile_qr'
                ? 'MON PROFIL & CODES QR'
                : 'COMPTE UTILISATEUR'}
            </Text>
          </View>
        </View>

        {currentUser && (
          <Pressable
            onPress={() => setActiveTab('auth')}
            style={styles.avatarChip}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {currentUser.first_name[0]}
                {currentUser.last_name[0]}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.avatarName} numberOfLines={1}>
                {currentUser.first_name}
              </Text>
              <Text style={styles.avatarTariff}>
                {formatChf(USER_CATEGORY_PRICES_CHF[currentUser.category])}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Corps de l'écran */}
      <View style={styles.body}>
        {activeTab === 'booking' && (
          <MenuBookingScreen onGoToProfileQr={() => setActiveTab('profile_qr')} />
        )}
        {activeTab === 'profile_qr' && <ProfileQrScreen />}
        {activeTab === 'staff' && <StaffDashboardScreen />}
        {activeTab === 'auth' && (
          <AuthScreen onAuthenticated={() => setActiveTab('booking')} />
        )}
      </View>

      {/* Barre de navigation inférieure style Stitch */}
      <View style={styles.bottomNav}>
        <Pressable
          onPress={() => setActiveTab('booking')}
          style={styles.navItem}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'booking' && styles.navIconPillActive,
            ]}
          >
            <Text style={styles.navIcon}>🍴</Text>
          </View>
          <Text
            style={[
              styles.navText,
              activeTab === 'booking' && styles.navTextActive,
            ]}
          >
            Menu & Réza
          </Text>
        </Pressable>

        {isStaffAdult && (
          <Pressable
            onPress={() => setActiveTab('staff')}
            style={styles.navItem}
          >
            <View
              style={[
                styles.navIconPill,
                activeTab === 'staff' && styles.navIconPillActive,
              ]}
            >
              <Text style={styles.navIcon}>▣</Text>
            </View>
            <Text
              style={[
                styles.navText,
                activeTab === 'staff' && styles.navTextActive,
              ]}
            >
              Pointage & Gestion
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => setActiveTab('profile_qr')}
          style={styles.navItem}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'profile_qr' && styles.navIconPillActive,
            ]}
          >
            <Text style={styles.navIcon}>🎫</Text>
          </View>
          <Text
            style={[
              styles.navText,
              activeTab === 'profile_qr' && styles.navTextActive,
            ]}
          >
            Mon QR Code
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('auth')}
          style={styles.navItem}
        >
          <View
            style={[
              styles.navIconPill,
              activeTab === 'auth' && styles.navIconPillActive,
            ]}
          >
            <Text style={styles.navIcon}>👤</Text>
          </View>
          <Text
            style={[styles.navText, activeTab === 'auth' && styles.navTextActive]}
          >
            Profil ({currentUser ? USER_CATEGORY_LABELS_FR[currentUser.category].split(' ')[0] : 'Connexion'})
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <CafeteriaProvider>
      <MainShell />
    </CafeteriaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: stitchTheme.colors.surface,
    paddingHorizontal: stitchTheme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: stitchTheme.colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoSquare: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: stitchTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoSunDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: stitchTheme.colors.twintYellow,
    position: 'absolute',
    top: 4,
  },
  logoEmoji: {
    fontSize: 16,
    marginTop: 6,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appTitle: {
    color: stitchTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  schoolBadge: {
    backgroundColor: stitchTheme.colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  schoolBadgeText: {
    color: stitchTheme.colors.accentDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubLabel: {
    color: stitchTheme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  avatarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: stitchTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: stitchTheme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.pill,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: stitchTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  avatarName: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
  },
  avatarTariff: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  body: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: stitchTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  navIconPill: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: stitchTheme.radius.pill,
  },
  navIconPillActive: {
    backgroundColor: stitchTheme.colors.primaryLight,
  },
  navIcon: {
    fontSize: 15,
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitchTheme.colors.textMuted,
  },
  navTextActive: {
    color: stitchTheme.colors.primary,
    fontWeight: '800',
  },
});
