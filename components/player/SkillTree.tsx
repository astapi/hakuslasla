import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { skillNodes, canUnlockSkill } from '@/data/skills';

export const SkillTree = () => {
  const { skillPoints, unlockedSkills, unlockSkill } = usePlayerStore();

  const handleUnlockSkill = (skillId: string) => {
    unlockSkill(skillId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>スキルツリー</Text>
        <Text style={styles.skillPoints}>SP: {skillPoints}</Text>
      </View>

      <ScrollView style={styles.skillList}>
        {skillNodes.map((skill, index) => {
          const isUnlocked = unlockedSkills.includes(skill.id);
          const canUnlock = canUnlockSkill(skill.id, unlockedSkills) && skillPoints > 0;

          return (
            <View key={skill.id}>
              {index > 0 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                </View>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.skillNode,
                  isUnlocked && styles.skillNodeUnlocked,
                  canUnlock && !isUnlocked && styles.skillNodeAvailable,
                  pressed && styles.skillNodePressed,
                ]}
                onPress={() => canUnlock && handleUnlockSkill(skill.id)}
                disabled={!canUnlock || isUnlocked}
              >
                <Text
                  style={[styles.skillName, isUnlocked && styles.skillNameUnlocked]}
                >
                  {skill.name}
                </Text>
                <Text style={styles.skillDescription}>{skill.description}</Text>
                {isUnlocked && <Text style={styles.unlockedBadge}>習得済み</Text>}
                {canUnlock && !isUnlocked && <Text style={styles.availableBadge}>習得可能</Text>}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 12,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  skillPoints: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  skillList: {
    flex: 1,
  },
  connector: {
    alignItems: 'center',
    height: 20,
  },
  connectorLine: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  skillNode: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skillNodeUnlocked: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  skillNodeAvailable: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  skillName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: 4,
  },
  skillNameUnlocked: {
    color: '#fff',
  },
  skillDescription: {
    fontSize: 12,
    color: '#888',
  },
  unlockedBadge: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 4,
    fontWeight: 'bold',
  },
  availableBadge: {
    fontSize: 10,
    color: '#FFD700',
    marginTop: 4,
    fontWeight: 'bold',
  },
  skillNodePressed: {
    opacity: 0.7,
  },
});
