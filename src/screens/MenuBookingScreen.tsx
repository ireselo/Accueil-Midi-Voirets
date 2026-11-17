import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCafeteria } from '../context/CafeteriaContext';
import { stitchTheme } from '../theme/stitchTheme';
import { ServiceSlot } from '../types/database';
import {
  USER_CATEGORY_LABELS_FR,
  USER_CATEGORY_PRICES_CHF,
  formatChf,
} from '../utils/cafeteriaRules';

const SHORT_DAY_META: Record<
  string,
  { shortDay: string; dayNum: string; fullBanner: string; deadlineShort: string }
> = {
  '2026-11-23': {
    shortDay: 'LUN',
    dayNum: '23',
    fullBanner: 'LUNDI 23 NOVEMBRE',
    deadlineShort: 'À valider avant ven. 18h00',
  },
  '2026-11-24': {
    shortDay: 'MAR',
    dayNum: '24',
    fullBanner: 'MARDI 24 NOVEMBRE',
    deadlineShort: 'À valider avant ven. 18h00',
  },
  '2026-11-26': {
    shortDay: 'JEU',
    dayNum: '26',
    fullBanner: 'JEUDI 26 NOVEMBRE',
    deadlineShort: 'À valider avant mer. 18h00',
  },
  '2026-11-27': {
    shortDay: 'VEN',
    dayNum: '27',
    fullBanner: 'VENDREDI 27 NOVEMBRE',
    deadlineShort: 'À valider avant mer. 18h00',
  },
};

export const MenuBookingScreen: React.FC<{ onGoToProfileQr: () => void }> = ({
  onGoToProfileQr,
}) => {
  const {
    settings,
    currentUser,
    selectedDate,
    setSelectedDate,
    availableDates,
    menus,
    reservations,
    getDailyConfirmedCount,
    getRemainingDailyPlaces,
    bookAndPayWithTwint,
  } = useCafeteria();

  const [selectedService, setSelectedService] = useState<ServiceSlot>('12h50');
  const [bookingFeedback, setBookingFeedback] = useState<{
    ok: boolean;
    messageFr: string;
  } | null>(null);

  const currentMenu = menus.find((m) => m.meal_date === selectedDate);
  const confirmedTotal = getDailyConfirmedCount(selectedDate);
  const remainingPlaces = getRemainingDailyPlaces(selectedDate);
  const cliCountToday = reservations.filter(
    (r) => r.meal_date === selectedDate && r.is_cli && r.status === 'confirmed'
  ).length;

  const userReservationToday = reservations.find(
    (r) =>
      r.meal_date === selectedDate &&
      r.user_id === currentUser?.id &&
      r.status === 'confirmed'
  );

  const userPriceChf = currentUser
    ? USER_CATEGORY_PRICES_CHF[currentUser.category]
    : 8.0;

  const dayMeta = SHORT_DAY_META[selectedDate] ?? {
    shortDay: 'JOUR',
    dayNum: '23',
    fullBanner: selectedDate,
    deadlineShort: 'Avant 18h00',
  };

  const handleBookAndPay = () => {
    const result = bookAndPayWithTwint(selectedDate, selectedService);
    setBookingFeedback({
      ok: result.ok,
      messageFr: result.messageFr,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Bandeau Utilisateur style Stitch */}
      {currentUser && (
        <View style={styles.userBannerCard}>
          <View style={styles.userAvatarBig}>
            <Text style={styles.userAvatarBigText}>
              {currentUser.first_name[0]}
              {currentUser.last_name[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userBannerName}>
              {currentUser.first_name} {currentUser.last_name}
            </Text>
            <Text style={styles.userBannerClass}>
              {currentUser.class_number
                ? `🎓 Classe ${currentUser.class_number} • ${
                    USER_CATEGORY_LABELS_FR[currentUser.category]
                  }`
                : `👤 ${USER_CATEGORY_LABELS_FR[currentUser.category]}`}
            </Text>
          </View>
          <View style={styles.pricePillRight}>
            <Text style={styles.pricePillSmallLabel}>Tarif repas</Text>
            <Text style={styles.pricePillAmount}>{formatChf(userPriceChf)}</Text>
          </View>
        </View>
      )}

      {/* 2. Sélecteur de la semaine (Lundi, Mardi, Jeudi, Vendredi) style Stitch */}
      <View style={styles.weekHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.weekTitle}>Semaine 48</Text>
          <View style={styles.seasonTag}>
            <Text style={styles.seasonTagText}>Lun • Mar • Jeu • Ven</Text>
          </View>
        </View>
      </View>

      <View style={styles.dayPillsRow}>
        {availableDates.map((d) => {
          const isSelected = d.date === selectedDate;
          const meta = SHORT_DAY_META[d.date];
          const isUserBooked = reservations.some(
            (r) =>
              r.meal_date === d.date &&
              r.user_id === currentUser?.id &&
              r.status === 'confirmed'
          );

          return (
            <Pressable
              key={d.date}
              onPress={() => {
                setSelectedDate(d.date);
                setBookingFeedback(null);
              }}
              style={[
                styles.dayVerticalPill,
                isSelected && styles.dayVerticalPillActive,
              ]}
            >
              <Text
                style={[
                  styles.dayPillShort,
                  isSelected && styles.dayPillTextActive,
                ]}
              >
                {meta?.shortDay ?? 'JOUR'}
              </Text>
              <Text
                style={[
                  styles.dayPillNumber,
                  isSelected && styles.dayPillTextActive,
                ]}
              >
                {meta?.dayNum ?? ''}
              </Text>
              <Text
                style={[
                  styles.dayPillStatus,
                  isSelected
                    ? styles.dayPillTextActive
                    : isUserBooked
                    ? { color: stitchTheme.colors.primary, fontWeight: '700' }
                    : null,
                ]}
              >
                {isUserBooked ? '✓ Inscrit' : 'Ouvert'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3. Carte Menu Unique du Jour avec Timeline (Style Stitch) */}
      <View style={styles.menuShowcaseCard}>
        {/* Visuel Hero du plat */}
        <View style={styles.heroFoodBanner}>
          <View style={styles.heroOverlayBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.heroOverlayText}>
              MENU DU JOUR • {dayMeta.fullBanner}
            </Text>
          </View>
          <Text style={styles.heroFoodIllustration}>🥘 🥗 🍽️</Text>
        </View>

        {/* Badges qualité */}
        <View style={styles.qualityTagsRow}>
          <View style={[styles.qTag, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.qTagText, { color: '#15803D' }]}>
              🌿 Fait Maison
            </Text>
          </View>
          <View style={[styles.qTag, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.qTagText, { color: '#B45309' }]}>
              🇨🇭 Produits Suisses
            </Text>
          </View>
          <View style={[styles.qTag, { backgroundColor: '#FFEDD5' }]}>
            <Text style={[styles.qTagText, { color: '#C2410C' }]}>
              {currentMenu?.composition_type === 'starter_main'
                ? 'Entrée + Plat principal'
                : 'Plat principal + Dessert'}
            </Text>
          </View>
        </View>

        {/* Timeline verticale des plats */}
        {currentMenu ? (
          <View style={styles.timelineWrap}>
            {currentMenu.composition_type === 'starter_main' && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineLeftCol}>
                  <View
                    style={[
                      styles.timelineIconCircle,
                      { backgroundColor: '#DCFCE7' },
                    ]}
                  >
                    <Text style={{ fontSize: 13 }}>🥗</Text>
                  </View>
                  <View style={styles.timelineVerticalLine} />
                </View>
                <View style={styles.timelineRightCol}>
                  <Text style={styles.timelineCourseLabel}>ENTRÉE</Text>
                  <Text style={styles.timelineCourseTitle}>
                    {currentMenu.starter_fr}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.timelineItem}>
              <View style={styles.timelineLeftCol}>
                <View
                  style={[
                    styles.timelineIconCircle,
                    { backgroundColor: '#FFEDD5' },
                  ]}
                >
                  <Text style={{ fontSize: 13 }}>🍲</Text>
                </View>
                {currentMenu.composition_type === 'main_dessert' && (
                  <View style={styles.timelineVerticalLine} />
                )}
              </View>
              <View style={styles.timelineRightCol}>
                <Text style={styles.timelineCourseLabel}>PLAT PRINCIPAL</Text>
                <Text style={styles.timelineCourseTitle}>
                  {currentMenu.main_course_fr}
                </Text>
                {currentMenu.notes_fr && (
                  <View style={styles.subNoteBox}>
                    <Text style={styles.subNoteText}>
                      ↳ {currentMenu.notes_fr}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {currentMenu.composition_type === 'main_dessert' && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineLeftCol}>
                  <View
                    style={[
                      styles.timelineIconCircle,
                      { backgroundColor: '#FEF3C7' },
                    ]}
                  >
                    <Text style={{ fontSize: 13 }}>🍎</Text>
                  </View>
                </View>
                <View style={styles.timelineRightCol}>
                  <Text style={styles.timelineCourseLabel}>DESSERT</Text>
                  <Text style={styles.timelineCourseTitle}>
                    {currentMenu.dessert_fr || 'Dessert du jour'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.emptyMenuText}>
            Le menu de ce jour sera publié prochainement par les cuisiniers.
          </Text>
        )}
      </View>

      {/* 4. Carte "Inscription du jour" (Style Stitch) */}
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.bookingIconCircle}>
              <Text style={{ color: stitchTheme.colors.primary, fontWeight: '900' }}>
                ✓
              </Text>
            </View>
            <Text style={styles.bookingCardTitle}>Inscription du jour</Text>
          </View>
          <View style={styles.deadlinePill}>
            <Text style={styles.deadlinePillText}>{dayMeta.deadlineShort}</Text>
          </View>
        </View>

        {/* Jauge sur 40 personnes max au total (incluant les 6 personnes de la CLI) */}
        <View style={styles.capacityNoticeBox}>
          <View style={styles.capacityRowBetween}>
            <Text style={styles.capacityLabel}>
              Places inscrites (max {settings.max_capacity} au total)
            </Text>
            <Text style={styles.capacityNumbers}>
              {confirmedTotal} / {settings.max_capacity} ({remainingPlaces}{' '}
              restantes)
            </Text>
          </View>
          <View style={styles.capacityBarTrack}>
            <View
              style={[
                styles.capacityBarFill,
                {
                  width: `${Math.min(
                    100,
                    (confirmedTotal / settings.max_capacity) * 100
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.cliFootnote}>
            Inclut {cliCountToday} places permanentes réservées pour le groupe CLI.
          </Text>
        </View>

        {/* Sélecteur des deux services : 12h00 et 12h50 (Style Stitch) */}
        <Text style={styles.chooseSlotLabel}>Choisir l’horaire de service :</Text>
        <View style={styles.serviceCardsRow}>
          {(['12h00', '12h50'] as ServiceSlot[]).map((slot) => {
            const isSelected = selectedService === slot;
            const slotCount = reservations.filter(
              (r) =>
                r.meal_date === selectedDate &&
                r.service === slot &&
                r.status === 'confirmed'
            ).length;

            return (
              <Pressable
                key={slot}
                onPress={() => setSelectedService(slot)}
                style={[
                  styles.serviceSlotCard,
                  isSelected && styles.serviceSlotCardSelected,
                ]}
              >
                <View style={styles.serviceSlotTopRow}>
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && <Text style={styles.radioCheck}>✓</Text>}
                  </View>
                  {isSelected ? (
                    <View style={styles.selectedPillBadge}>
                      <Text style={styles.selectedPillBadgeText}>Sélectionné</Text>
                    </View>
                  ) : (
                    <Text style={styles.serviceOrderLabel}>
                      {slot === '12h00' ? '1er service' : '2ème service'}
                    </Text>
                  )}
                </View>

                <Text
                  style={[
                    styles.serviceSlotBigTime,
                    isSelected && { color: '#FFFFFF' },
                  ]}
                >
                  {slot}
                </Text>
                <Text
                  style={[
                    styles.serviceSlotFooter,
                    isSelected && { color: '#DCFCE7' },
                  ]}
                >
                  {slot === '12h00' ? '1er service' : '2ème service'} • {slotCount}{' '}
                  inscrits
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bouton principal Valider l'inscription + Prix CHF (Style Stitch) */}
        {userReservationToday ? (
          <View style={styles.alreadyRegisteredBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alreadyRegTitle}>
                ✓ Inscrit(e) au service de {userReservationToday.service}
              </Text>
              <Text style={styles.alreadyRegSub}>
                Code QR : {userReservationToday.qr_code_token}
              </Text>
            </View>
            <Pressable style={styles.viewQrBtn} onPress={onGoToProfileQr}>
              <Text style={styles.viewQrBtnText}>Voir mon QR</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleBookAndPay}
            disabled={remainingPlaces <= 0}
            style={[
              styles.validateMainBtn,
              remainingPlaces <= 0 && { opacity: 0.5 },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.validateBtnIcon}>▣</Text>
              <Text style={styles.validateBtnText}>
                Valider l’inscription (Twint)
              </Text>
            </View>
            <View style={styles.validateBtnPriceBox}>
              <Text style={styles.validateBtnPriceText}>
                {formatChf(userPriceChf)}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Barre d'infos sous le bouton (comme sur le design Stitch) */}
        <View style={styles.bottomMicroInfoRow}>
          <Text style={styles.microInfoItem}>💳 Paiement Twint (Payrexx)</Text>
          <Text style={styles.microInfoItem}>✉️ E-mail de confirmation</Text>
          <Text style={styles.microInfoItem}>▣ QR Direct</Text>
        </View>

        {bookingFeedback && (
          <View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: bookingFeedback.ok
                  ? stitchTheme.colors.successLight
                  : stitchTheme.colors.dangerLight,
              },
            ]}
          >
            <Text
              style={{
                color: bookingFeedback.ok
                  ? stitchTheme.colors.primaryDark
                  : stitchTheme.colors.danger,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              {bookingFeedback.messageFr}
            </Text>
          </View>
        )}
      </View>

      {/* 5. Section "Jours suivants" (Style Stitch) */}
      <View style={styles.nextDaysCard}>
        <View style={styles.nextDaysHeader}>
          <Text style={styles.nextDaysTitle}>📅 Jours d’ouverture de la semaine</Text>
          <Text style={styles.nextDaysHint}>Clôture ven. 18h / mer. 18h</Text>
        </View>

        {availableDates.map((d) => {
          const m = menus.find((item) => item.meal_date === d.date);
          const meta = SHORT_DAY_META[d.date];
          const isBooked = reservations.some(
            (r) =>
              r.meal_date === d.date &&
              r.user_id === currentUser?.id &&
              r.status === 'confirmed'
          );

          return (
            <Pressable
              key={d.date}
              onPress={() => setSelectedDate(d.date)}
              style={styles.nextDayRow}
            >
              <View style={styles.nextDayNumBox}>
                <Text style={styles.nextDayNumText}>{meta?.dayNum}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextDayLabel}>{d.labelFr}</Text>
                <Text style={styles.nextDayDish} numberOfLines={1}>
                  {m?.main_course_fr ?? 'Menu à venir'}
                </Text>
              </View>
              <View
                style={[
                  styles.nextDayStatusPill,
                  isBooked && { backgroundColor: '#DBEAFE' },
                ]}
              >
                <Text
                  style={[
                    styles.nextDayStatusText,
                    isBooked && { color: '#1D4ED8' },
                  ]}
                >
                  {isBooked ? '✓ Inscrit' : 'Voir'}
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
  content: { padding: stitchTheme.spacing.md, gap: 14 },
  userBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: stitchTheme.colors.surface,
    padding: 12,
    borderRadius: stitchTheme.radius.lg,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  userAvatarBig: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: stitchTheme.colors.primaryLight,
    borderWidth: 2,
    borderColor: stitchTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarBigText: {
    color: stitchTheme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 15,
  },
  userBannerName: {
    fontSize: 16,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  userBannerClass: {
    fontSize: 12,
    color: stitchTheme.colors.textSecondary,
    marginTop: 2,
  },
  pricePillRight: {
    backgroundColor: stitchTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: stitchTheme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'flex-end',
  },
  pricePillSmallLabel: {
    fontSize: 10,
    color: stitchTheme.colors.textMuted,
    fontWeight: '600',
  },
  pricePillAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  seasonTag: {
    backgroundColor: stitchTheme.colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: stitchTheme.radius.pill,
  },
  seasonTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.accentDark,
  },
  dayPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayVerticalPill: {
    flex: 1,
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  dayVerticalPillActive: {
    backgroundColor: stitchTheme.colors.primary,
    borderColor: stitchTheme.colors.primary,
  },
  dayPillShort: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.textMuted,
  },
  dayPillNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: stitchTheme.colors.textPrimary,
    marginVertical: 2,
  },
  dayPillStatus: {
    fontSize: 10,
    fontWeight: '600',
    color: stitchTheme.colors.textMuted,
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  menuShowcaseCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    paddingBottom: 14,
  },
  heroFoodBanner: {
    height: 110,
    backgroundColor: '#1E293B',
    justifyContent: 'space-between',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroOverlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  heroOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heroFoodIllustration: {
    fontSize: 28,
  },
  qualityTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  qTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.pill,
  },
  qTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 30,
  },
  timelineIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: stitchTheme.colors.border,
    marginVertical: 4,
    minHeight: 18,
  },
  timelineRightCol: {
    flex: 1,
    paddingBottom: 12,
  },
  timelineCourseLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: stitchTheme.colors.textMuted,
    letterSpacing: 0.5,
  },
  timelineCourseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
    marginTop: 2,
  },
  subNoteBox: {
    marginTop: 6,
    backgroundColor: stitchTheme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.sm,
  },
  subNoteText: {
    fontSize: 12,
    color: stitchTheme.colors.primaryDark,
    fontWeight: '600',
  },
  emptyMenuText: {
    padding: 14,
    fontSize: 13,
    color: stitchTheme.colors.textMuted,
  },
  bookingCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  bookingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  bookingIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: stitchTheme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  deadlinePill: {
    backgroundColor: stitchTheme.colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.sm,
  },
  deadlinePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.accentDark,
  },
  capacityNoticeBox: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    padding: 12,
    borderRadius: stitchTheme.radius.md,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    marginBottom: 14,
  },
  capacityRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
  capacityNumbers: {
    fontSize: 12,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
  },
  capacityBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: stitchTheme.radius.pill,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    backgroundColor: stitchTheme.colors.primary,
  },
  cliFootnote: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    marginTop: 6,
  },
  chooseSlotLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
    marginBottom: 8,
  },
  serviceCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  serviceSlotCard: {
    flex: 1,
    padding: 12,
    borderRadius: stitchTheme.radius.lg,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.border,
    backgroundColor: stitchTheme.colors.surface,
  },
  serviceSlotCardSelected: {
    backgroundColor: stitchTheme.colors.primary,
    borderColor: stitchTheme.colors.primary,
  },
  serviceSlotTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  radioCheck: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  selectedPillBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: stitchTheme.radius.pill,
  },
  selectedPillBadgeText: {
    color: stitchTheme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  serviceOrderLabel: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    fontWeight: '600',
  },
  serviceSlotBigTime: {
    fontSize: 20,
    fontWeight: '900',
    color: stitchTheme.colors.textPrimary,
  },
  serviceSlotFooter: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
  },
  validateMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: stitchTheme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: stitchTheme.radius.lg,
  },
  validateBtnIcon: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  validateBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  validateBtnPriceBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.md,
  },
  validateBtnPriceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  alreadyRegisteredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: stitchTheme.colors.primarySoft,
    borderWidth: 1,
    borderColor: stitchTheme.colors.primary,
    padding: 12,
    borderRadius: stitchTheme.radius.lg,
    gap: 10,
  },
  alreadyRegTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDark,
  },
  alreadyRegSub: {
    fontSize: 11,
    color: stitchTheme.colors.textSecondary,
    marginTop: 2,
  },
  viewQrBtn: {
    backgroundColor: stitchTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: stitchTheme.radius.md,
  },
  viewQrBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  bottomMicroInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.surfaceMuted,
  },
  microInfoItem: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    fontWeight: '600',
  },
  feedbackBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: stitchTheme.radius.md,
  },
  nextDaysCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  nextDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextDaysTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  nextDaysHint: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
  },
  nextDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.surfaceMuted,
  },
  nextDayNumBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextDayNumText: {
    fontSize: 14,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  nextDayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
  },
  nextDayDish: {
    fontSize: 12,
    color: stitchTheme.colors.textMuted,
  },
  nextDayStatusPill: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  nextDayStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
});
