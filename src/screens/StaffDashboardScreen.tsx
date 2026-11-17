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
  MenuCompositionType,
  ServiceSlot,
  StaffRole,
  UserCategory,
} from '../types/database';
import {
  STAFF_ROLE_LABELS_FR,
  USER_CATEGORY_LABELS_FR,
  formatChf,
} from '../utils/cafeteriaRules';

const ALL_STAFF_ROLES: StaffRole[] = [
  'surveillant',
  'cuisinier',
  'civiliste',
  'comptable',
  'administrateur',
];

export const StaffDashboardScreen: React.FC = () => {
  const {
    settings,
    currentUser,
    users,
    selectedDate,
    setSelectedDate,
    availableDates,
    menus,
    reservations,
    payments,
    cliInvoices,
    cliMembers,
    getDailyConfirmedCount,
    confirmAttendanceByQr,
    toggleCliAttendanceManual,
    registerClientManually,
    saveDailyMenu,
    addRecipeIngredient,
    toggleShoppingItemChecked,
    getScaledShoppingListForDate,
    toggleCliReservationCancelled,
    updateCliSettings,
    generateCliInvoiceForPeriod,
    updateStudentSubsidy,
    toggleAdultStaffRole,
  } = useCafeteria();

  const userRoles = currentUser?.staff_roles ?? [];
  const [activeTab, setActiveTab] = useState<StaffRole>(
    userRoles[0] ?? 'surveillant'
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // États Réception & Pointage (Surveillant - Style Stitch)
  const [showQrInputBox, setShowQrInputBox] = useState(false);
  const [qrScanInput, setQrScanInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | '12h00' | '12h50' | 'CLI'>('ALL');
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualService, setManualService] = useState<ServiceSlot>('12h00');
  const [manualCategory, setManualCategory] = useState<UserCategory>('student');

  // États Cuisine & Ajout (Cuisinier - Style Stitch)
  const currentMenu = menus.find((m) => m.meal_date === selectedDate);
  const [compType, setCompType] = useState<MenuCompositionType>(
    currentMenu?.composition_type ?? 'starter_main'
  );
  const [starterInput, setStarterInput] = useState(currentMenu?.starter_fr ?? '');
  const [mainInput, setMainInput] = useState(currentMenu?.main_course_fr ?? '');
  const [dessertInput, setDessertInput] = useState(
    currentMenu?.dessert_fr ?? 'Dessert du jour'
  );
  const [baseServingsInput, setBaseServingsInput] = useState(
    String(currentMenu?.recipe_base_servings ?? 20)
  );
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('kg');

  // États Comptable (CLI & Paiements)
  const [cliPriceInput, setCliPriceInput] = useState(
    String(settings.cli_meal_price_chf)
  );
  const [invoiceStart, setInvoiceStart] = useState('2026-11-01');
  const [invoiceEnd, setInvoiceEnd] = useState('2026-11-30');

  if (!currentUser || currentUser.category !== 'adult' || userRoles.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Espace réservé aux membres de la cafétéria</Text>
        <Text style={styles.emptySubtitle}>
          Seuls les adultes disposant d’un rôle de gestion ont accès à cet écran.
        </Text>
      </View>
    );
  }

  const dayReservations = reservations.filter((r) => r.meal_date === selectedDate);
  const confirmedToday = getDailyConfirmedCount(selectedDate);
  const occupancyPct = Math.round((confirmedToday / settings.max_capacity) * 100);
  const scaledShopping = getScaledShoppingListForDate(selectedDate);

  // Filtrage de la liste des inscrits (Style Stitch Réception & Pointage)
  const filteredReservations = dayReservations.filter((r) => {
    if (serviceFilter === '12h00' && r.service !== '12h00') return false;
    if (serviceFilter === '12h50' && r.service !== '12h50') return false;
    if (serviceFilter === 'CLI' && !r.is_cli) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const u = users.find((usr) => usr.id === r.user_id);
    const cli = cliMembers.find((c) => c.id === r.cli_member_id);
    const fullText = `${u?.first_name ?? ''} ${u?.last_name ?? ''} ${
      u?.class_number ?? ''
    } ${cli?.display_name ?? ''} ${r.manual_guest_name ?? ''}`.toLowerCase();
    return fullText.includes(q);
  });

  const cliConfirmedCount = dayReservations.filter(
    (r) => r.is_cli && r.status === 'confirmed'
  ).length;
  const studentsConfirmedCount = dayReservations.filter((r) => {
    if (r.is_cli || r.status !== 'confirmed') return false;
    const u = users.find((usr) => usr.id === r.user_id);
    return u ? u.category !== 'adult' : r.manual_guest_category !== 'adult';
  }).length;
  const adultsConfirmedCount = Math.max(
    0,
    confirmedToday - cliConfirmedCount - studentsConfirmedCount
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Navigation entre les 5 rôles de gestion de la cafétéria */}
      <View style={styles.roleSwitcherCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.rolePillsRow}>
            {userRoles.map((role) => {
              const isSelected = activeTab === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => {
                    setActiveTab(role);
                    setStatusMessage(null);
                  }}
                  style={[
                    styles.roleTabPill,
                    isSelected && styles.roleTabPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleTabText,
                      isSelected && styles.roleTabTextActive,
                    ]}
                  >
                    {STAFF_ROLE_LABELS_FR[role].title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Sélecteur rapide de jour (Lun, Mar, Jeu, Ven) */}
        <View style={styles.datesMiniRow}>
          {availableDates.map((d) => {
            const active = d.date === selectedDate;
            return (
              <Pressable
                key={d.date}
                onPress={() => setSelectedDate(d.date)}
                style={[styles.dateChip, active && styles.dateChipActive]}
              >
                <Text style={[styles.dateChipText, active && { color: '#FFF' }]}>
                  {d.labelFr}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {statusMessage && (
        <View style={styles.bannerMessage}>
          <Text style={styles.bannerMessageText}>{statusMessage}</Text>
        </View>
      )}

      {/* =====================================================================
          1. SURVEILLANT — ÉCRAN STITCH "RÉCEPTION & POINTAGE"
         ===================================================================== */}
      {activeTab === 'surveillant' && (
        <>
          <View style={styles.stitchCard}>
            <View style={styles.serviceTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.serviceStatusText}>SERVICE EN COURS</Text>
              </View>
              <View style={styles.serviceSlotBadge}>
                <Text style={styles.serviceSlotBadgeText}>
                  🕒 1er : 12h00 • 2e : 12h50
                </Text>
              </View>
            </View>

            <View style={styles.counterBigRow}>
              <View>
                <Text style={styles.counterSmallLabel}>PERSONNES INSCRITES</Text>
                <Text style={styles.counterBigNumber}>
                  {confirmedToday}{' '}
                  <Text style={styles.counterMaxSlash}>/ {settings.max_capacity}</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pctBigText}>{occupancyPct}%</Text>
                <Text style={styles.pctSubLabel}>Fréquentation (max 40)</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, occupancyPct)}%` },
                ]}
              />
            </View>

            {/* Bouton vert "Scanner le badge / QR Code" exactement comme sur Stitch */}
            <Pressable
              style={styles.scanQrMainBtn}
              onPress={() => setShowQrInputBox((prev) => !prev)}
            >
              <Text style={styles.scanQrMainBtnText}>
                ▣ Scanner le badge / QR Code
              </Text>
            </Pressable>

            {showQrInputBox && (
              <View style={styles.qrScannerDrawer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Code QR (ex: AMV-QR-20261123-LUCAS-12H00)"
                  value={qrScanInput}
                  onChangeText={setQrScanInput}
                />
                <Pressable
                  style={styles.validateQrSmallBtn}
                  onPress={() => {
                    const res = confirmAttendanceByQr(qrScanInput);
                    setStatusMessage(res.messageFr);
                    if (res.ok) setQrScanInput('');
                  }}
                >
                  <Text style={styles.validateQrSmallBtnText}>Confirmer</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Barre de recherche et filtres (Tous, 12h00, 12h50, CLI) style Stitch */}
          <View style={styles.searchBarBox}>
            <Text style={{ fontSize: 14 }}>🔍</Text>
            <TextInput
              style={styles.searchBarInput}
              placeholder="Rechercher par nom, prénom ou classe..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.filterPillsRow}>
            {(
              [
                { id: 'ALL', label: 'Tous les inscrits' },
                { id: '12h00', label: 'Service 12h00' },
                { id: '12h50', label: 'Service 12h50' },
                { id: 'CLI', label: 'Groupe CLI (6)' },
              ] as const
            ).map((f) => {
              const active = serviceFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setServiceFilter(f.id)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && { color: '#FFFFFF' },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Cartes individuelles des convives (Style Stitch Réception & Pointage) */}
          {filteredReservations.map((r) => {
            const userObj = users.find((u) => u.id === r.user_id);
            const cliObj = cliMembers.find((c) => c.id === r.cli_member_id);
            const displayName = r.is_cli
              ? cliObj?.display_name ?? 'Membre CLI'
              : userObj
              ? `${userObj.first_name} ${userObj.last_name}`
              : r.manual_guest_name ?? 'Client';

            const subTag = r.is_cli
              ? 'CLI • Sans QR Code'
              : userObj?.class_number
              ? `Classe ${userObj.class_number}`
              : 'Adulte';

            return (
              <View key={r.id} style={styles.dinerStitchCard}>
                <View style={styles.dinerCardTopRow}>
                  <View
                    style={[
                      styles.dinerAvatar,
                      r.is_cli && { backgroundColor: stitchTheme.colors.cliBadgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dinerAvatarText,
                        r.is_cli && { color: stitchTheme.colors.cliBadgeText },
                      ]}
                    >
                      {r.is_cli ? 'CLI' : displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.dinerCardName}>{displayName}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                      <View
                        style={[
                          styles.classBadge,
                          r.is_cli && {
                            backgroundColor: stitchTheme.colors.cliBadgeBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.classBadgeText,
                            r.is_cli && { color: stitchTheme.colors.cliBadgeText },
                          ]}
                        >
                          {subTag}
                        </Text>
                      </View>
                      <Text style={styles.dinerPriceLabel}>
                        {formatChf(r.price_chf)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timeGreenBadge}>
                    <Text style={styles.timeGreenBadgeText}>🕒 {r.service}</Text>
                  </View>
                </View>

                {r.status === 'cancelled' ? (
                  <View style={styles.cancelledStrip}>
                    <Text style={styles.cancelledStripText}>
                      Inscription annulée ponctuellement
                    </Text>
                  </View>
                ) : r.attended ? (
                  <Pressable
                    onPress={() => toggleCliAttendanceManual(r.id)}
                    style={styles.validatedStrip}
                  >
                    <Text style={styles.validatedStripText}>
                      🍴 Repas servi & présence confirmée
                    </Text>
                    <View style={styles.validatedMiniPill}>
                      <Text style={styles.validatedMiniPillText}>Validé</Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => toggleCliAttendanceManual(r.id)}
                    style={styles.pointerGreenBtn}
                  >
                    <Text style={styles.pointerGreenBtnText}>
                      {r.is_cli
                        ? '✓ Pointer la présence CLI (Manuel sans QR)'
                        : '✓ Pointer la présence du client'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {/* Carte Orange d'inscription manuelle (Style Stitch "Ajout exceptionnel") */}
          <View style={styles.manualAddStitchCard}>
            <Text style={styles.manualAddTitle}>
              ⊕ Inscrire un client manuellement (Surveillant)
            </Text>
            <Text style={styles.manualAddSub}>
              Places disponibles sur les 40 du jour :{' '}
              {Math.max(0, settings.max_capacity - confirmedToday)}
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Nom et prénom du client..."
              value={manualGuestName}
              onChangeText={setManualGuestName}
            />
            <View style={[styles.filterPillsRow, { marginTop: 8 }]}>
              {(['12h00', '12h50'] as ServiceSlot[]).map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() => setManualService(slot)}
                  style={[
                    styles.filterChip,
                    manualService === slot && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      manualService === slot && { color: '#FFF' },
                    ]}
                  >
                    Service {slot}
                  </Text>
                </Pressable>
              ))}
              {(['student', 'adult'] as UserCategory[]).map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setManualCategory(cat)}
                  style={[
                    styles.filterChip,
                    manualCategory === cat && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      manualCategory === cat && { color: '#FFF' },
                    ]}
                  >
                    {USER_CATEGORY_LABELS_FR[cat]}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.orangeManualBtn}
              onPress={() => {
                const res = registerClientManually(
                  selectedDate,
                  manualService,
                  manualGuestName,
                  manualCategory
                );
                setStatusMessage(res.messageFr);
                if (res.ok) setManualGuestName('');
              }}
            >
              <Text style={styles.orangeManualBtnText}>
                ⊕ Ajout manuel ({manualCategory === 'adult' ? '10.00 CHF' : '8.00 CHF'})
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* =====================================================================
          2. CUISINIER — ÉCRAN STITCH "CUISINE & AJOUT DE MENU"
         ===================================================================== */}
      {activeTab === 'cuisinier' && (
        <>
          {/* Carte Effectifs & Portions (Style Stitch) */}
          <View style={styles.stitchCard}>
            <View style={styles.serviceTopRow}>
              <Text style={styles.bookingCardTitle}>📈 Effectifs & Portions</Text>
              <View style={styles.cuisineActivePill}>
                <Text style={styles.cuisineActivePillText}>● Cuisine active</Text>
              </View>
            </View>

            <View style={styles.totalOrderedGreenBox}>
              <View>
                <Text style={styles.totalOrderedLabel}>TOTAL COMMANDÉ</Text>
                <Text style={styles.totalOrderedBig}>
                  {confirmedToday}{' '}
                  <Text style={{ fontSize: 13, fontWeight: '600' }}>
                    / {settings.max_capacity} repas prévus
                  </Text>
                </Text>
              </View>
              <View style={styles.logoSquareSmall}>
                <Text style={{ color: '#FFF', fontSize: 16 }}>🍴</Text>
              </View>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownCol}>
                <Text style={styles.breakdownTitle}>Élèves</Text>
                <Text style={[styles.breakdownNum, { color: stitchTheme.colors.primary }]}>
                  {studentsConfirmedCount}
                </Text>
              </View>
              <View style={styles.breakdownCol}>
                <Text style={styles.breakdownTitle}>Adultes</Text>
                <Text style={[styles.breakdownNum, { color: stitchTheme.colors.accent }]}>
                  {adultsConfirmedCount}
                </Text>
              </View>
              <View style={styles.breakdownCol}>
                <Text style={styles.breakdownTitle}>Groupe CLI</Text>
                <Text style={[styles.breakdownNum, { color: '#6D28D9' }]}>
                  {cliConfirmedCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Carte Programmer un menu (Style Stitch) */}
          <View style={styles.stitchCard}>
            <Text style={styles.bookingCardTitle}>
              📋 Programmer le menu du {selectedDate}
            </Text>
            <Text style={styles.subtitle}>
              Formule au choix : Entrée + Plat principal OU Plat principal + Dessert
            </Text>

            <View style={[styles.filterPillsRow, { marginVertical: 8 }]}>
              <Pressable
                onPress={() => setCompType('starter_main')}
                style={[
                  styles.filterChip,
                  compType === 'starter_main' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    compType === 'starter_main' && { color: '#FFF' },
                  ]}
                >
                  Entrée + Plat principal
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCompType('main_dessert')}
                style={[
                  styles.filterChip,
                  compType === 'main_dessert' && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    compType === 'main_dessert' && { color: '#FFF' },
                  ]}
                >
                  Plat principal + Dessert
                </Text>
              </Pressable>
            </View>

            {compType === 'starter_main' && (
              <>
                <Text style={styles.fieldLabel}>Entrée *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Velouté de potimarron rôti aux graines de courge"
                  value={starterInput}
                  onChangeText={setStarterInput}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Plat principal *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Filet de lieu noir MSC au coulis de poivrons doux"
              value={mainInput}
              onChangeText={setMainInput}
            />

            {compType === 'main_dessert' && (
              <>
                <Text style={styles.fieldLabel}>
                  Dessert (souvent sans spécifier — par défaut « Dessert du jour »)
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Dessert du jour"
                  value={dessertInput}
                  onChangeText={setDessertInput}
                />
              </>
            )}

            {/* Fiche Ingrédients & Portions (Style Stitch) */}
            <View style={styles.ingredientsTechBox}>
              <View style={styles.serviceTopRow}>
                <Text style={styles.fieldLabel}>⚖️ Fiche Ingrédients & Portions</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 11, color: stitchTheme.colors.textMuted }}>
                    Recette pour :
                  </Text>
                  <TextInput
                    style={[styles.input, { width: 65, paddingVertical: 4 }]}
                    keyboardType="numeric"
                    value={baseServingsInput}
                    onChangeText={setBaseServingsInput}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '700' }}>pers.</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Ingrédient (ex: Viande, Légumes)"
                  value={ingName}
                  onChangeText={setIngName}
                />
                <TextInput
                  style={[styles.input, { width: 70 }]}
                  placeholder="Qté"
                  keyboardType="numeric"
                  value={ingQty}
                  onChangeText={setIngQty}
                />
                <TextInput
                  style={[styles.input, { width: 65 }]}
                  placeholder="kg/L"
                  value={ingUnit}
                  onChangeText={setIngUnit}
                />
              </View>

              <Pressable
                style={styles.transferShoppingBtn}
                onPress={() => {
                  const res = addRecipeIngredient(
                    selectedDate,
                    ingName,
                    Number(ingQty) || 1,
                    ingUnit,
                    'Cuisine'
                  );
                  setStatusMessage(res.messageFr);
                  if (res.ok) {
                    setIngName('');
                    setIngQty('');
                  }
                }}
              >
                <Text style={styles.transferShoppingBtnText}>
                  🛒 Ajouter & Transférer vers la liste des courses
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.scanQrMainBtn, { marginTop: 14 }]}
              onPress={() => {
                const res = saveDailyMenu(
                  selectedDate,
                  compType,
                  starterInput,
                  mainInput,
                  dessertInput,
                  Number(baseServingsInput) || 20
                );
                setStatusMessage(res.messageFr);
              }}
            >
              <Text style={styles.scanQrMainBtnText}>
                📤 Publier ce menu sur l’application
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* =====================================================================
          3. CIVILISTE (ET CUISINIER) — LISTE DES COURSES PROPORTIONNÉE
         ===================================================================== */}
      {(activeTab === 'civiliste' || activeTab === 'cuisinier') && (
        <View style={styles.stitchCard}>
          <Text style={styles.bookingCardTitle}>
            🛒 Liste des courses & approvisionnement ({confirmedToday} inscrits)
          </Text>
          <Text style={styles.subtitle}>
            Quantités automatiquement ajustées pour {confirmedToday} convives par rapport à la
            recette de base ({currentMenu?.recipe_base_servings ?? 20} pers.).
          </Text>

          {scaledShopping.map((item) => (
            <Pressable
              key={item.ingredient_id}
              onPress={() => toggleShoppingItemChecked(item.ingredient_id)}
              style={styles.shoppingItemRow}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.dinerCardName,
                    item.is_checked && {
                      textDecorationLine: 'line-through',
                      color: stitchTheme.colors.textMuted,
                    },
                  ]}
                >
                  {item.ingredient_name_fr}
                </Text>
                <Text style={styles.dinerPriceLabel}>
                  Recette ({item.base_servings} pers.) : {item.quantity_for_base} {item.unit}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.scaledQtyHighlight}>
                  {item.scaled_quantity} {item.unit}
                </Text>
                <Text style={{ fontSize: 11, color: stitchTheme.colors.primary }}>
                  {item.is_checked ? '✓ Acheté' : 'À acheter'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* =====================================================================
          4. COMPTABLE — PAIEMENTS TWINT (PAYREXX) & FACTURATION CLI
         ===================================================================== */}
      {activeTab === 'comptable' && (
        <>
          <View style={styles.stitchCard}>
            <Text style={styles.bookingCardTitle}>
              🧾 Facturation du groupe CLI (6 personnes)
            </Text>
            <Text style={styles.subtitle}>
              Facturation calculée en fonction des jours où la présence des membres CLI a été
              confirmée par les surveillants.
            </Text>

            <View style={[styles.filterPillsRow, { marginTop: 8 }]}>
              {(['12h00', '12h50'] as ServiceSlot[]).map((slot) => (
                <Pressable
                  key={slot}
                  onPress={() =>
                    updateCliSettings(slot, Number(cliPriceInput) || settings.cli_meal_price_chf)
                  }
                  style={[
                    styles.filterChip,
                    settings.cli_default_service === slot && styles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      settings.cli_default_service === slot && { color: '#FFF' },
                    ]}
                  >
                    CLI Service {slot}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                style={[styles.input, { width: 90 }]}
                keyboardType="numeric"
                value={cliPriceInput}
                onChangeText={setCliPriceInput}
                placeholder="CHF"
              />
              <Pressable
                style={styles.validateQrSmallBtn}
                onPress={() => {
                  updateCliSettings(
                    settings.cli_default_service,
                    Number(cliPriceInput) || 8.0
                  );
                  setStatusMessage(
                    `Tarif CLI mis à jour : ${(Number(cliPriceInput) || 8.0).toFixed(2)} CHF`
                  );
                }}
              >
                <Text style={styles.validateQrSmallBtnText}>Tarif CHF</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={invoiceStart}
                onChangeText={setInvoiceStart}
                placeholder="Début YYYY-MM-DD"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={invoiceEnd}
                onChangeText={setInvoiceEnd}
                placeholder="Fin YYYY-MM-DD"
              />
            </View>

            <Pressable
              style={[styles.scanQrMainBtn, { marginTop: 10 }]}
              onPress={() => {
                const res = generateCliInvoiceForPeriod(invoiceStart, invoiceEnd);
                setStatusMessage(res.messageFr);
              }}
            >
              <Text style={styles.scanQrMainBtnText}>
                Générer une facture CLI selon les jours de présence
              </Text>
            </Pressable>

            {cliInvoices.map((inv) => (
              <View key={inv.id} style={styles.shoppingItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dinerCardName}>Facture {inv.invoice_number}</Text>
                  <Text style={styles.dinerPriceLabel}>
                    Du {inv.period_start} au {inv.period_end} • {inv.total_meals_attended}{' '}
                    repas présents × {formatChf(inv.unit_price_chf)}
                  </Text>
                </View>
                <Text style={styles.scaledQtyHighlight}>
                  {formatChf(inv.total_amount_chf)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.stitchCard}>
            <Text style={styles.bookingCardTitle}>
              💳 Paiements Twint / Payrexx ({payments.length})
            </Text>
            {payments.map((p) => {
              const payer = users.find((u) => u.id === p.user_id);
              return (
                <View key={p.id} style={styles.shoppingItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dinerCardName}>
                      {payer ? `${payer.first_name} ${payer.last_name}` : 'Client'}
                    </Text>
                    <Text style={styles.dinerPriceLabel}>
                      {p.payment_method} • Réf : {p.payrexx_transaction_id ?? 'Exonéré'}
                    </Text>
                  </View>
                  <Text style={styles.scaledQtyHighlight}>{formatChf(p.amount_chf)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* =====================================================================
          5. ANNULATION PONCTUELLE DE LA CLI (ADMIN & COMPTABLE)
         ===================================================================== */}
      {(activeTab === 'administrateur' || activeTab === 'comptable') && (
        <View style={styles.stitchCard}>
          <Text style={styles.bookingCardTitle}>
            🗓️ Annulation ponctuelle de la CLI ({selectedDate})
          </Text>
          <Text style={styles.subtitle}>
            L’administrateur et le comptable peuvent annuler ponctuellement l’inscription de
            ces clients pour libérer des places sur le quota de 40.
          </Text>
          {dayReservations
            .filter((r) => r.is_cli)
            .map((cliRes) => {
              const member = cliMembers.find((c) => c.id === cliRes.cli_member_id);
              const isCancelled = cliRes.status === 'cancelled';
              return (
                <View key={cliRes.id} style={styles.shoppingItemRow}>
                  <View>
                    <Text style={styles.dinerCardName}>
                      {member?.display_name ?? 'CLI'} ({cliRes.service})
                    </Text>
                    <Text style={styles.dinerPriceLabel}>
                      {isCancelled ? 'Annulé ponctuellement' : 'Inscrit'} •{' '}
                      {formatChf(cliRes.price_chf)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      const res = toggleCliReservationCancelled(cliRes.id);
                      setStatusMessage(res.messageFr);
                    }}
                    style={[
                      styles.cancelBtn,
                      isCancelled && { backgroundColor: stitchTheme.colors.primary },
                    ]}
                  >
                    <Text style={styles.cancelBtnText}>
                      {isCancelled ? 'Réactiver' : 'Annuler'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
        </View>
      )}

      {/* =====================================================================
          6. ADMINISTRATEUR — GESTION DES SUBVENTIONS ÉLÈVES & RÔLES MULTIPLES
         ===================================================================== */}
      {activeTab === 'administrateur' && (
        <View style={styles.stitchCard}>
          <Text style={styles.bookingCardTitle}>
            👥 Gestion des subventions élèves & rôles des membres
          </Text>
          <Text style={styles.subtitle}>
            Autorisez les subventions partielles (4.00 CHF) ou totales (0.00 CHF) pour les
            élèves, et attribuez plusieurs rôles de gestion aux adultes.
          </Text>

          {users.map((u) => (
            <View key={u.id} style={styles.adminUserItem}>
              <Text style={styles.dinerCardName}>
                {u.first_name} {u.last_name}{' '}
                {u.class_number ? `(Classe ${u.class_number})` : '(Adulte)'}
              </Text>
              <Text style={styles.dinerPriceLabel}>
                {u.email} • {USER_CATEGORY_LABELS_FR[u.category]}
              </Text>

              {u.category !== 'adult' ? (
                <View style={[styles.filterPillsRow, { marginTop: 8 }]}>
                  {(
                    [
                      { cat: 'student', label: '8.00 CHF (Standard)' },
                      { cat: 'student_partial_subsidy', label: '4.00 CHF (Partiel)' },
                      { cat: 'student_full_subsidy', label: '0.00 CHF (Total)' },
                    ] as const
                  ).map((opt) => (
                    <Pressable
                      key={opt.cat}
                      onPress={() => {
                        const res = updateStudentSubsidy(u.id, opt.cat);
                        setStatusMessage(res.messageFr);
                      }}
                      style={[
                        styles.filterChip,
                        u.category === opt.cat && styles.filterChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          u.category === opt.cat && { color: '#FFF' },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={[styles.filterPillsRow, { marginTop: 8 }]}>
                  {ALL_STAFF_ROLES.map((role) => {
                    const hasRole = u.staff_roles.includes(role);
                    return (
                      <Pressable
                        key={role}
                        onPress={() => {
                          const res = toggleAdultStaffRole(u.id, role);
                          setStatusMessage(res.messageFr);
                        }}
                        style={[
                          styles.filterChip,
                          hasRole && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            hasRole && { color: '#FFF' },
                          ]}
                        >
                          {hasRole ? '✓ ' : '+ '}
                          {STAFF_ROLE_LABELS_FR[role].title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: stitchTheme.colors.background },
  content: { padding: stitchTheme.spacing.md, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: stitchTheme.colors.textPrimary },
  emptySubtitle: {
    fontSize: 13,
    color: stitchTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  roleSwitcherCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    gap: 10,
  },
  rolePillsRow: { flexDirection: 'row', gap: 8 },
  roleTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  roleTabPillActive: {
    backgroundColor: stitchTheme.colors.primary,
    borderColor: stitchTheme.colors.primary,
  },
  roleTabText: { fontSize: 12, fontWeight: '700', color: stitchTheme.colors.textPrimary },
  roleTabTextActive: { color: '#FFFFFF' },
  datesMiniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.sm,
    backgroundColor: stitchTheme.colors.surfaceMuted,
  },
  dateChipActive: { backgroundColor: stitchTheme.colors.textPrimary },
  dateChipText: { fontSize: 11, fontWeight: '700', color: stitchTheme.colors.textPrimary },
  bannerMessage: {
    backgroundColor: stitchTheme.colors.primaryLight,
    borderColor: stitchTheme.colors.primary,
    borderWidth: 1,
    padding: 10,
    borderRadius: stitchTheme.radius.md,
  },
  bannerMessageText: {
    color: stitchTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  stitchCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  serviceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: stitchTheme.colors.primary,
  },
  serviceStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
    letterSpacing: 0.5,
  },
  serviceSlotBadge: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.pill,
  },
  serviceSlotBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: stitchTheme.colors.textSecondary,
  },
  counterBigRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  counterSmallLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: stitchTheme.colors.textMuted,
  },
  counterBigNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: stitchTheme.colors.textPrimary,
  },
  counterMaxSlash: {
    fontSize: 18,
    fontWeight: '600',
    color: stitchTheme.colors.textMuted,
  },
  pctBigText: {
    fontSize: 18,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  pctSubLabel: {
    fontSize: 10,
    color: stitchTheme.colors.textMuted,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: stitchTheme.radius.pill,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    backgroundColor: stitchTheme.colors.primary,
  },
  scanQrMainBtn: {
    backgroundColor: stitchTheme.colors.primary,
    paddingVertical: 13,
    borderRadius: stitchTheme.radius.lg,
    alignItems: 'center',
  },
  scanQrMainBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  qrScannerDrawer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    borderRadius: stitchTheme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#FFFFFF',
    color: stitchTheme.colors.textPrimary,
  },
  validateQrSmallBtn: {
    backgroundColor: stitchTheme.colors.primaryDark,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: stitchTheme.radius.sm,
  },
  validateQrSmallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
    color: stitchTheme.colors.textPrimary,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.surface,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  filterChipActive: {
    backgroundColor: stitchTheme.colors.primary,
    borderColor: stitchTheme.colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
  dinerStitchCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    gap: 10,
  },
  dinerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dinerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dinerAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  dinerCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  classBadge: {
    backgroundColor: stitchTheme.colors.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  classBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: stitchTheme.colors.textSecondary,
  },
  dinerPriceLabel: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
  },
  timeGreenBadge: {
    backgroundColor: stitchTheme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.pill,
  },
  timeGreenBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDark,
  },
  validatedStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: stitchTheme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: stitchTheme.radius.md,
  },
  validatedStripText: {
    fontSize: 12,
    color: stitchTheme.colors.textSecondary,
    fontWeight: '600',
  },
  validatedMiniPill: {
    backgroundColor: stitchTheme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: stitchTheme.radius.pill,
  },
  validatedMiniPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDark,
  },
  cancelledStrip: {
    backgroundColor: stitchTheme.colors.dangerLight,
    padding: 8,
    borderRadius: stitchTheme.radius.sm,
  },
  cancelledStripText: {
    fontSize: 11,
    color: stitchTheme.colors.danger,
    fontWeight: '700',
  },
  pointerGreenBtn: {
    backgroundColor: stitchTheme.colors.primary,
    paddingVertical: 10,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'center',
  },
  pointerGreenBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  manualAddStitchCard: {
    backgroundColor: stitchTheme.colors.surface,
    borderRadius: stitchTheme.radius.xl,
    padding: 16,
    borderWidth: 1.5,
    borderColor: stitchTheme.colors.accentLight,
  },
  manualAddTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  manualAddSub: {
    fontSize: 12,
    color: stitchTheme.colors.textSecondary,
    marginTop: 2,
  },
  orangeManualBtn: {
    marginTop: 12,
    backgroundColor: stitchTheme.colors.accent,
    paddingVertical: 12,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'center',
  },
  orangeManualBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  bookingCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: stitchTheme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: stitchTheme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  cuisineActivePill: {
    backgroundColor: stitchTheme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: stitchTheme.radius.pill,
  },
  cuisineActivePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDark,
  },
  totalOrderedGreenBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: stitchTheme.colors.primarySoft,
    padding: 14,
    borderRadius: stitchTheme.radius.lg,
    marginBottom: 12,
  },
  totalOrderedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: stitchTheme.colors.primaryDark,
  },
  totalOrderedBig: {
    fontSize: 26,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  logoSquareSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: stitchTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  breakdownCol: {
    flex: 1,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    padding: 10,
    borderRadius: stitchTheme.radius.md,
  },
  breakdownTitle: {
    fontSize: 11,
    color: stitchTheme.colors.textMuted,
    fontWeight: '600',
  },
  breakdownNum: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  ingredientsTechBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: stitchTheme.colors.surfaceMuted,
    borderRadius: stitchTheme.radius.lg,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  transferShoppingBtn: {
    marginTop: 10,
    backgroundColor: stitchTheme.colors.surface,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    paddingVertical: 10,
    borderRadius: stitchTheme.radius.md,
    alignItems: 'center',
  },
  transferShoppingBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: stitchTheme.colors.textPrimary,
  },
  shoppingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.surfaceMuted,
    marginTop: 6,
  },
  scaledQtyHighlight: {
    fontSize: 15,
    fontWeight: '900',
    color: stitchTheme.colors.primary,
  },
  cancelBtn: {
    backgroundColor: stitchTheme.colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: stitchTheme.radius.sm,
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  adminUserItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: stitchTheme.colors.surfaceMuted,
    marginTop: 6,
  },
});
