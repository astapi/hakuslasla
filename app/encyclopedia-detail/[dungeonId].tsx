import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/common/Button';
import { ScreenWrapper } from '@/components/common/ScreenWrapper';
import { getDungeon } from '@/data/dungeons';
import { getEnemy } from '@/data/enemies';
import { getItemBase, getModDescription } from '@/data/items';
import { getMonsterImage } from '@/data/images';
import { getBossAbilities, isUberDungeon, BossSkillInfo } from '@/data/bossSkillInfo';
import { Dungeon, Enemy, ItemBase } from '@/types';
import { ms, fs } from '@/utils/scaling';

export default function EncyclopediaDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { dungeonId } = useLocalSearchParams<{ dungeonId: string }>();
  const [dungeon, setDungeon] = useState<Dungeon | null>(null);

  useEffect(() => {
    if (dungeonId) {
      const dungeonData = getDungeon(dungeonId);
      if (dungeonData) {
        setDungeon(dungeonData);
      }
    }
  }, [dungeonId]);

  const handleBack = () => {
    router.back();
  };

  if (!dungeon) {
    return (
      <ScreenWrapper>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{t(`dungeons.${dungeon.id}.name`)}</Text>
        <Text style={styles.description}>{t(`dungeons.${dungeon.id}.description`)}</Text>
        <Text style={styles.floors}>{t('dungeon.floors', { count: dungeon.maxFloor })}</Text>

        {/* 出現モンスター */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('encyclopedia.detail.monsters')}</Text>
          <View style={styles.monsterList}>
            {dungeon.monsters
              .filter((spawn) => !dungeon.boss || spawn.monsterId !== dungeon.boss.monsterId)
              .map((spawn) => {
              const enemy = getEnemy(spawn.monsterId);
              if (!enemy) return null;

              return (
                <MonsterCard key={spawn.monsterId} enemy={enemy} />
              );
            })}
            {/* ボスモンスター */}
            {dungeon.boss && (() => {
              const bossEnemy = getEnemy(dungeon.boss.monsterId);
              if (!bossEnemy) return null;
              return <MonsterCard key={dungeon.boss.monsterId} enemy={bossEnemy} isBoss={true} dungeonId={dungeon.id} />;
            })()}
          </View>
        </View>

        {/* ドロップアイテム */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('encyclopedia.detail.drops')}</Text>

          {/* ダンジョン固有ドロップ */}
          <View style={styles.dropSection}>
            <Text style={styles.dropSectionTitle}>{t('encyclopedia.detail.dungeonDrops')}</Text>
            <View style={styles.itemList}>
              {dungeon.dropTable.dungeon.map((drop) => {
                const item = getItemBase(drop.itemId);
                if (!item) return null;
                return (
                  <ItemCard key={drop.itemId} item={item} />
                );
              })}
            </View>
          </View>

          {/* 共通ドロップ */}
          <View style={styles.dropSection}>
            <Text style={styles.dropSectionTitle}>{t('encyclopedia.detail.commonDrops')}</Text>
            <View style={styles.itemList}>
              {dungeon.dropTable.common.map((drop) => {
                const item = getItemBase(drop.itemId);
                if (!item) return null;
                return (
                  <ItemCard key={drop.itemId} item={item} />
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title={t('common.back')} onPress={handleBack} variant="secondary" />
      </View>
    </ScreenWrapper>
  );
}

interface MonsterCardProps {
  enemy: Enemy;
  isBoss?: boolean;
  dungeonId?: string;
}

function MonsterCard({ enemy, isBoss = false, dungeonId }: MonsterCardProps) {
  const { t } = useTranslation();
  const bossAbilities = isBoss ? getBossAbilities(enemy.id) : null;
  const isUber = dungeonId ? isUberDungeon(dungeonId) : false;

  // スキルをフィルタリング（Uberでない場合はUber限定スキルを除外）
  const filterSkills = (skills: BossSkillInfo[]) => {
    if (isUber) return skills;
    return skills.filter((skill) => !skill.isUberOnly);
  };

  const regularSkills = bossAbilities ? filterSkills(bossAbilities.regularSkills) : [];
  const thresholdSkills = bossAbilities ? filterSkills(bossAbilities.thresholdSkills) : [];
  const hasAbilities = regularSkills.length > 0 || thresholdSkills.length > 0;

  return (
    <View style={[styles.monsterCard, isBoss && styles.monsterCardBoss]}>
      <View style={styles.monsterContent}>
        <Image source={getMonsterImage(enemy.image)} style={styles.monsterImage} resizeMode="contain" />
        <View style={styles.monsterInfo}>
          <View style={styles.monsterNameRow}>
            <Text style={styles.monsterName}>{t(`monsters.${enemy.id}.name`)}</Text>
            {isBoss && <Text style={styles.bossBadge}>BOSS</Text>}
          </View>
          <View style={styles.monsterStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>HP</Text>
          <Text style={styles.statValue}>{enemy.maxHp}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>ATK</Text>
          <Text style={styles.statValue}>{enemy.atk}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>DEF</Text>
          <Text style={styles.statValue}>{enemy.def}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>EXP</Text>
          <Text style={styles.statValue}>{enemy.exp}</Text>
        </View>
        {enemy.attackSpeed && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>AS</Text>
            <Text style={styles.statValue}>{enemy.attackSpeed.toFixed(1)}</Text>
          </View>
        )}
          </View>
        </View>
      </View>

      {/* ボス能力 */}
      {isBoss && hasAbilities && bossAbilities && (
        <View style={styles.bossAbilitiesContainer}>
          <Text style={styles.bossAbilitiesTitle}>{t('encyclopedia.detail.bossAbilities')}</Text>

          {/* 通常スキル */}
          {regularSkills.length > 0 && (
            <View style={styles.skillSection}>
              <Text style={styles.skillSectionTitle}>{t('encyclopedia.detail.regularSkills')}</Text>
              {regularSkills.map((skill) => (
                <View key={skill.skillKey} style={styles.skillItem}>
                  <View style={styles.skillNameRow}>
                    <Text style={styles.skillName}>
                      {t(`bossSkills.${bossAbilities.bossId}.${skill.skillKey}`)}
                    </Text>
                    {skill.isUberOnly && (
                      <Text style={styles.uberOnlyBadge}>{t('encyclopedia.detail.uberOnly')}</Text>
                    )}
                  </View>
                  <Text style={styles.skillDesc}>
                    {t(`bossSkills.${bossAbilities.bossId}.${skill.descKey}`)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* HP50%以下スキル */}
          {thresholdSkills.length > 0 && (
            <View style={styles.skillSection}>
              <Text style={styles.skillSectionTitle}>{t('encyclopedia.detail.thresholdSkills')}</Text>
              {thresholdSkills.map((skill) => (
                <View key={skill.skillKey} style={styles.skillItem}>
                  <View style={styles.skillNameRow}>
                    <Text style={styles.skillName}>
                      {t(`bossSkills.${bossAbilities.bossId}.${skill.skillKey}`)}
                    </Text>
                    {skill.isUberOnly && (
                      <Text style={styles.uberOnlyBadge}>{t('encyclopedia.detail.uberOnly')}</Text>
                    )}
                  </View>
                  <Text style={styles.skillDesc}>
                    {t(`bossSkills.${bossAbilities.bossId}.${skill.descKey}`)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ユニークドロップ */}
      {(enemy.uniqueDrop || enemy.uniqueDrops) && (
        <View style={styles.uniqueDropContainer}>
          <Text style={styles.uniqueDropTitle}>{t('encyclopedia.detail.uniqueDrops')}</Text>
          {enemy.uniqueDrops ? (
            // 複数ユニークドロップ（Uber用）
            enemy.uniqueDrops.map((drop) => (
              <UniqueDropItem key={drop.itemId} itemId={drop.itemId} />
            ))
          ) : enemy.uniqueDrop ? (
            // 単一ユニークドロップ
            <UniqueDropItem itemId={enemy.uniqueDrop.itemId} />
          ) : null}
        </View>
      )}
    </View>
  );
}

interface UniqueDropItemProps {
  itemId: string;
}

function UniqueDropItem({ itemId }: UniqueDropItemProps) {
  const { t } = useTranslation();
  const item = getItemBase(itemId);

  if (!item) return null;

  return (
    <View style={styles.uniqueDropItem}>
      <Text style={styles.uniqueDropName}>{t(`items.${item.id}.name`)}</Text>
      {item.fixedMods && item.fixedMods.length > 0 && (
        <View style={styles.modsContainer}>
          <Text style={styles.modsTitle}>{t('encyclopedia.detail.fixedMods')}:</Text>
          {item.fixedMods.map((mod, index) => (
            <Text key={index} style={styles.modText}>
              • {getModDescription(mod)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

interface ItemCardProps {
  item: ItemBase;
}

function ItemCard({ item }: ItemCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{t(`items.${item.id}.name`)}</Text>
        <Text style={styles.itemSlot}>{t(`slots.${item.slot}`)}</Text>
      </View>
      <View style={styles.itemStats}>
        {item.atk > 0 && (
          <Text style={styles.itemStat}>ATK +{item.atk}</Text>
        )}
        {item.def > 0 && (
          <Text style={styles.itemStat}>DEF +{item.def}</Text>
        )}
      </View>

      {item.fixedMods && item.fixedMods.length > 0 && (
        <View style={styles.modsContainer}>
          <Text style={styles.modsTitle}>{t('encyclopedia.detail.fixedMods')}:</Text>
          {item.fixedMods.map((mod, index) => (
            <Text key={index} style={styles.modText}>
              • {getModDescription(mod)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: ms(16),
  },
  loadingText: {
    fontSize: fs(16),
    color: '#fff',
    textAlign: 'center',
    marginTop: ms(40),
  },
  title: {
    fontSize: fs(24),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  description: {
    fontSize: fs(14),
    color: '#aaa',
    textAlign: 'center',
    marginBottom: ms(8),
  },
  floors: {
    fontSize: fs(14),
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: ms(24),
    fontWeight: 'bold',
  },
  section: {
    marginBottom: ms(32),
  },
  sectionTitle: {
    fontSize: fs(20),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: ms(16),
  },
  monsterList: {
    gap: ms(12),
  },
  monsterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: ms(12),
    padding: ms(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  monsterCardBoss: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 2,
  },
  monsterContent: {
    flexDirection: 'row',
    gap: ms(12),
  },
  monsterImage: {
    width: ms(60),
    height: ms(60),
    borderRadius: ms(8),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  monsterInfo: {
    flex: 1,
  },
  monsterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginBottom: ms(8),
  },
  monsterName: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
  },
  bossBadge: {
    fontSize: fs(10),
    fontWeight: 'bold',
    color: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
    borderRadius: ms(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  monsterStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(12),
    marginBottom: ms(8),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(4),
    minWidth: ms(60),
  },
  statLabel: {
    fontSize: fs(12),
    color: '#aaa',
  },
  statValue: {
    fontSize: fs(12),
    color: '#fff',
    fontWeight: 'bold',
  },
  bossAbilitiesContainer: {
    marginTop: ms(12),
    paddingTop: ms(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.3)',
  },
  bossAbilitiesTitle: {
    fontSize: fs(14),
    color: '#FF6B6B',
    fontWeight: 'bold',
    marginBottom: ms(12),
  },
  skillSection: {
    marginBottom: ms(12),
  },
  skillSectionTitle: {
    fontSize: fs(12),
    color: '#aaa',
    marginBottom: ms(8),
  },
  skillItem: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: ms(8),
    padding: ms(10),
    marginBottom: ms(8),
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  skillNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(8),
    marginBottom: ms(4),
  },
  skillName: {
    fontSize: fs(13),
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  skillDesc: {
    fontSize: fs(11),
    color: '#ccc',
    lineHeight: fs(16),
  },
  uberOnlyBadge: {
    fontSize: fs(9),
    color: '#9370DB',
    backgroundColor: 'rgba(147, 112, 219, 0.2)',
    paddingHorizontal: ms(5),
    paddingVertical: ms(2),
    borderRadius: ms(3),
    fontWeight: 'bold',
  },
  uniqueDropContainer: {
    marginTop: ms(12),
    paddingTop: ms(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  uniqueDropTitle: {
    fontSize: fs(14),
    color: '#FFD700',
    fontWeight: 'bold',
    marginBottom: ms(8),
  },
  uniqueDropItem: {
    paddingVertical: ms(4),
  },
  uniqueDropName: {
    fontSize: fs(13),
    color: '#FFD700',
    fontWeight: 'bold',
  },
  modsContainer: {
    marginTop: ms(8),
  },
  modsTitle: {
    fontSize: fs(12),
    color: '#9370DB',
    fontWeight: 'bold',
    marginBottom: ms(4),
  },
  modText: {
    fontSize: fs(11),
    color: '#9370DB',
    marginLeft: ms(4),
  },
  dropSection: {
    marginBottom: ms(24),
  },
  dropSectionTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: ms(12),
  },
  itemList: {
    gap: ms(8),
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: ms(8),
    padding: ms(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: ms(8),
  },
  itemName: {
    fontSize: fs(14),
    fontWeight: 'bold',
    color: '#fff',
  },
  itemSlot: {
    fontSize: fs(11),
    color: '#888',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(4),
  },
  itemStats: {
    flexDirection: 'row',
    gap: ms(12),
    marginBottom: ms(4),
  },
  itemStat: {
    fontSize: fs(12),
    color: '#4CAF50',
  },
  footer: {
    padding: ms(16),
    paddingBottom: ms(32),
  },
});
