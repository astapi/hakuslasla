import { View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AppStatus } from '@/lib/remoteConfig';

type Props = {
  status: Extract<AppStatus, { type: 'update_required' | 'maintenance' }>;
};

export function ForceUpdateModal({ status }: Props) {
  const { t } = useTranslation();

  if (status.type === 'maintenance') {
    return (
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{t('forceUpdate.maintenanceTitle')}</Text>
          <Text style={styles.message}>
            {status.message || t('forceUpdate.maintenanceMessage')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>{t('forceUpdate.updateTitle')}</Text>
        <Text style={styles.message}>{t('forceUpdate.updateMessage')}</Text>
        <Pressable
          style={styles.button}
          onPress={() => Linking.openURL(status.storeUrl)}
        >
          <Text style={styles.buttonText}>{t('forceUpdate.updateButton')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    backgroundColor: '#1E2230',
    borderRadius: 16,
    padding: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3040',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#B0B8C8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
