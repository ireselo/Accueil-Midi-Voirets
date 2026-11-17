import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCafeteria } from '../context/CafeteriaContext';
import { stitchTheme } from '../theme/stitchTheme';
import {
  STAFF_ROLE_LABELS_FR,
  USER_CATEGORY_LABELS_FR,
  USER_CATEGORY_PRICES_CHF,
  formatChf,
} from '../utils/cafeteriaRules';

export const ProfileQrScreen: React.FC = () => {
  const { currentUser, reservations, payments } = useCafeteria();

  if (!currentUser) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Aucun utilisateur connecté.</Text>
      </View>
    );
  }

  const userReservations = reservations.filter(
    (r) => r.user_id === currentUser.id && r.status === 'confirmed'
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Informations du profil */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Mon Profil Personnel</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom complet :</Text>
            <Text style={styles.infoValue}>
              {currentUser.first_name} {currentUser.last_name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>E-mail :</Text>
            <Text style={styles.infoValue}>{currentUser.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Catégorie :</Text>
            <Text style={styles.infoValue}>
              {USER_CATEGORY_LABELS_FR[currentUser.category]}
            </Text>
          </View>
          {currentUser.class_number && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Numéro de classe :</Text>
              <Text style={styles.infoValue}>{currentUser.class_number}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tarif repas :</Text>
            <Text style={[styles.infoValue, { color: stitchTheme.colors.primaryDark }]}>
              {formatChf(USER_CATEGORY_PRICES_CHF[currentUser.category])}
            </Text>
          </View>
        </View>

        {currentUser.staff_roles.length > 0 && (
          <View style={styles.staffBox}>
            <Text style={styles.staffBoxTitle}>
              Membre de la cafétéria — Rôles actifs ({currentUser.staff_roles.length}) :
            </Text>
            <View style={styles.rolesWrap}>
              {currentUser.staff_roles.map((r) => (
                <View key={r} style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{STAFF_ROLE_LABELS_FR[r].title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Liste des inscriptions et Codes QR personnels */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Mes Inscriptions & Codes QR Personnels ({userReservations.length})
        </Text>
        <Text style={styles.subtitle}>
          Chaque réservation confirmée génère un code QR personnel unique envoyé par e-mail et
          accessible ci-dessous pour présentation aux surveillants.
        </Text>

        {userReservations.length === 0 ? (
          <Text style={styles.emptySubtitle}>
            Vous n’avez pas encore d’inscription active. Rendez-vous dans l’onglet « Menu &
            Réservation » pour vous inscrire.
          </Text>
        ) : (
          userReservations.map((res) => {
            const payment = payments.find((p) => p.reservation_id === res.id);
            return (
              <View key={res.id} style={styles.qrTicketCard}>
                <View style={styles.qrHeader}>
                  <View>
                    <Text style={styles.qrDateText}>Repas du {res.meal_date}</Text>
                    <Text style={styles.qrServiceText}>
                      Service de {res.service} — {formatChf(res.price_chf)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceBadge,
                      {
                        backgroundColor: res.attended
                          ? stitchTheme.colors.successLight
                          : stitchTheme.colors.warningLight,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: res.attended
                          ? stitchTheme.colors.success
                          : stitchTheme.colors.warning,
                      }}
                    >
                      {res.attended ? 'Présence validée' : 'À présenter'}
                    </Text>
                  </View>
                </View>

                {/* Représentation visuelle du Code QR personnel */}
                <View style={styles.qrCodeBox}>
                  <View style={styles.qrVisualSquare}>
                    <Text style={styles.qrVisualIcon}>▣ QR ▣</Text>
                    <Text style={styles.qrTokenMono}>{res.qr_code_token}</Text>
                  </View>
                  <Text style={styles.emailSentNote}>
                    ✉️ E-mail de confirmation avec ce code QR envoyé à {currentUser.email}
                    {payment?.payrexx_transaction_id
                      ? ` • Réf. Twint : ${payment.payrexx_transaction_id}`
                      : ''}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { padding: stitchTheme.spacing.md, gap: stitchTheme.spacing.md },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: stitchTheme.colors.textSecondary },
  card: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    padding: stitchTheme.spacing.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: stitchTheme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  emptySubtitle: { fontSize: 13, color: stitchTheme.colors.textMuted },
  infoGrid: { gap: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: stitchTheme.colors.surfaceMuted,
  },
  infoLabel: { fontSize: 13, color: stitchTheme.colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '700', color: stitchTheme.colors.textPrimary },
  staffBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  staffBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: stitchTheme.colors.primaryDark,
    marginBottom: 8,
  },
  rolesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rolePill: {
    backgroundColor: stitchTheme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.pill,
  },
  rolePillText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  qrTicketCard: {
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.border,
    borderRadius: stitchTheme.radius.md,
    padding: 14,
    marginTop: 10,
    backgroundColor: '#FAFAFA',
  },
  qrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrDateText: { fontSize: 15, fontWeight: '800', color: stitchTheme.colors.textPrimary },
  qrServiceText: { fontSize: 13, color: stitchTheme.colors.textSecondary, marginTop: 2 },
  attendanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  qrCodeBox: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: stitchTheme.radius.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  qrVisualSquare: {
    width: 190,
    height: 140,
    borderWidth: 2,
    borderColor: stitchTheme.colors.textPrimary,
    borderRadius: stitchTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  qrVisualIcon: {
    fontSize: 24,
    fontWeight: '900',
    color: stitchTheme.colors.textPrimary,
    marginBottom: 8,
  },
  qrTokenMono: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.primaryDark,
    textAlign: 'center',
  },
  emailSentNote: {
    marginTop: 10,
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    textAlign: 'center',
  },
});
