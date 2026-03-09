import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Share } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { ms, fs } from '@/utils/scaling';
import { getOrCreateMyInviteCode, redeemInviteCode, checkInviterReward, ServiceSuspendedError } from '@/lib/inviteCode';
import { hasSpeedBoost } from '@/stores/usePurchaseStore';

const colors = {
  bg: '#15191E',
  bgDeep: '#101418',
  slab: '#1B2026',
  slabEdge: '#2A3037',
  accent: '#232833',
  text: '#C9CDD3',
  textMuted: '#8C929A',
};

export function InviteCodeSection() {
  const { t } = useTranslation();
  const [myCode, setMyCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const isActivated = hasSpeedBoost();

  const loadMyCode = useCallback(async () => {
    setIsLoading(true);
    try {
      const code = await getOrCreateMyInviteCode();
      setMyCode(code);
      // 招待者報酬も確認
      await checkInviterReward();
    } catch (error) {
      if (error instanceof ServiceSuspendedError) {
        setIsSuspended(true);
      } else {
        console.error('[InviteCode] Failed to load code:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyCode();
  }, [loadMyCode]);

  const handleCopy = async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!myCode) return;
    try {
      await Share.share({
        message: t('settings.inviteCode.shareText', { code: myCode }),
      });
    } catch {
      // ユーザーがキャンセルした場合
    }
  };

  const handleSubmit = async () => {
    const code = inputCode.toUpperCase().trim();
    if (code.length !== 6) {
      Alert.alert('', t('settings.inviteCode.error.invalidFormat'));
      return;
    }

    setIsSubmitting(true);
    const result = await redeemInviteCode(code);
    setIsSubmitting(false);

    if (result.success) {
      Alert.alert(
        t('settings.inviteCode.success.title'),
        t('settings.inviteCode.success.message'),
      );
      setInputCode('');
    } else if (result.error === 'service_suspended') {
      setIsSuspended(true);
    } else {
      const errorKey = `settings.inviteCode.error.${result.error === 'own_code' ? 'ownCode' : result.error === 'not_found' ? 'notFound' : result.error === 'already_used' ? 'alreadyUsed' : result.error === 'already_redeemed' ? 'alreadyRedeemed' : 'networkError'}`;
      Alert.alert('', t(errorKey));
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.inviteCode.title')}</Text>
      <Text style={styles.sectionDescription}>
        {t('settings.inviteCode.description')}
      </Text>

      {/* 一時停止中 */}
      {isSuspended && !isActivated && (
        <View style={styles.suspendedBadge}>
          <MaterialCommunityIcons name="pause-circle-outline" size={ms(16)} color="#FFA726" />
          <Text style={styles.suspendedText}>
            {t('settings.inviteCode.suspended')}
          </Text>
        </View>
      )}

      {/* 有効化済みバッジ */}
      {isActivated && (
        <View style={styles.activatedBadge}>
          <MaterialCommunityIcons name="check-circle" size={ms(16)} color="#4CAF50" />
          <Text style={styles.activatedText}>
            {t('settings.inviteCode.activated')}
          </Text>
        </View>
      )}

      {/* 自分のコード表示（未有効化かつ未停止の場合のみ） */}
      {!isActivated && !isSuspended && (
        <View style={styles.myCodeContainer}>
          <Text style={styles.myCodeLabel}>{t('settings.inviteCode.myCode')}</Text>
          <View style={styles.myCodeRow}>
            <Text style={styles.myCodeText}>
              {isLoading ? '...' : myCode ?? '------'}
            </Text>
            <View style={styles.codeActions}>
              <Pressable
                style={styles.codeActionButton}
                onPress={handleCopy}
                disabled={!myCode}
              >
                <MaterialCommunityIcons
                  name={copied ? 'check' : 'content-copy'}
                  size={ms(18)}
                  color={copied ? '#4CAF50' : '#4ECDC4'}
                />
              </Pressable>
              <Pressable
                style={styles.codeActionButton}
                onPress={handleShare}
                disabled={!myCode}
              >
                <MaterialCommunityIcons
                  name="share-variant"
                  size={ms(18)}
                  color="#4ECDC4"
                />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* コード入力フォーム（未有効化かつ未停止の場合のみ） */}
      {!isActivated && !isSuspended && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('settings.inviteCode.enterCode')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputCode}
              onChangeText={(text) => setInputCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={t('settings.inviteCode.placeholder')}
              placeholderTextColor="#555"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.submitButton,
                (inputCode.length !== 6 || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={inputCode.length !== 6 || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? t('settings.inviteCode.submitting')
                  : t('settings.inviteCode.submit')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: ms(24),
    backgroundColor: colors.slab,
    borderRadius: ms(12),
    padding: ms(16),
    borderWidth: 1,
    borderColor: colors.slabEdge,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: ms(10),
    shadowOffset: { width: 0, height: ms(6) },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: ms(4),
  },
  sectionDescription: {
    fontSize: fs(12),
    color: colors.textMuted,
    marginBottom: ms(16),
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    backgroundColor: 'rgba(255, 167, 38, 0.15)',
    paddingVertical: ms(8),
    paddingHorizontal: ms(12),
    borderRadius: ms(8),
    marginBottom: ms(12),
  },
  suspendedText: {
    fontSize: fs(13),
    color: '#FFA726',
    fontWeight: '600',
  },
  activatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: ms(8),
    paddingHorizontal: ms(12),
    borderRadius: ms(8),
    marginBottom: ms(12),
  },
  activatedText: {
    fontSize: fs(13),
    color: '#4CAF50',
    fontWeight: '600',
  },
  myCodeContainer: {
    marginBottom: ms(12),
  },
  myCodeLabel: {
    fontSize: fs(12),
    color: colors.textMuted,
    marginBottom: ms(6),
  },
  myCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
    borderWidth: 1,
    borderColor: colors.slabEdge,
  },
  myCodeText: {
    fontSize: fs(22),
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  codeActions: {
    flexDirection: 'row',
    gap: ms(8),
  },
  codeActionButton: {
    width: ms(36),
    height: ms(36),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: ms(8),
  },
  inputContainer: {
    marginTop: ms(4),
  },
  inputLabel: {
    fontSize: fs(12),
    color: colors.textMuted,
    marginBottom: ms(6),
  },
  inputRow: {
    flexDirection: 'row',
    gap: ms(8),
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bgDeep,
    borderRadius: ms(8),
    paddingVertical: ms(10),
    paddingHorizontal: ms(14),
    fontSize: fs(16),
    color: '#fff',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: colors.slabEdge,
    fontVariant: ['tabular-nums'],
  },
  submitButton: {
    backgroundColor: '#4CAF50',
    borderRadius: ms(8),
    paddingHorizontal: ms(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#333',
  },
  submitButtonText: {
    fontSize: fs(14),
    fontWeight: '600',
    color: '#fff',
  },
});
