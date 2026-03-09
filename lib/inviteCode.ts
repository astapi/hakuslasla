import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from '@react-native-firebase/firestore';
import { getDeviceId } from '@/lib/firestore';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { usePurchaseStore } from '@/stores/usePurchaseStore';

// ============================================
// Constants
// ============================================

const COLLECTION_NAME = 'invite_codes';

// 紛らわしい文字を除外 (O/0/I/1/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

// ============================================
// Types
// ============================================

export type RedeemResult =
  | { success: true }
  | { success: false; error: 'own_code' | 'not_found' | 'already_used' | 'already_redeemed' | 'network_error' | 'service_suspended' };

// ============================================
// Helpers
// ============================================

const isPermissionDenied = (error: any): boolean => {
  const code = error?.code ?? '';
  return code === 'firestore/permission-denied' || code === 'permission-denied';
};

export class ServiceSuspendedError extends Error {
  constructor() {
    super('Service suspended');
    this.name = 'ServiceSuspendedError';
  }
}

const generateCode = (): string => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
};

// ============================================
// API
// ============================================

/**
 * 自分の招待コードを取得または作成
 * ローカルキャッシュ → Firestore取得/新規作成
 */
export const getOrCreateMyInviteCode = async (): Promise<string> => {
  // ローカルキャッシュ確認
  const cached = await settingsRepository.getMyInviteCode();
  if (cached) return cached;

  try {
    const deviceId = await getDeviceId();
    const db = getFirestore();
    const docRef = doc(db, COLLECTION_NAME, deviceId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as { code: string };
      await settingsRepository.setMyInviteCode(data.code);
      return data.code;
    }

    // 新規作成
    const code = generateCode();
    await setDoc(docRef, {
      code,
      codeUsed: false,
      createdAt: serverTimestamp(),
      usedBy: null,
      usedAt: null,
      redeemedCode: null,
      redeemedAt: null,
    });

    await settingsRepository.setMyInviteCode(code);
    return code;
  } catch (error: any) {
    if (isPermissionDenied(error)) {
      throw new ServiceSuspendedError();
    }
    throw error;
  }
};

/**
 * 招待コードを使用（被招待者が入力）
 * Firestoreトランザクションで招待者・被招待者の両ドキュメントを同時更新
 */
export const redeemInviteCode = async (inputCode: string): Promise<RedeemResult> => {
  const code = inputCode.toUpperCase().trim();
  const deviceId = await getDeviceId();

  // 自分のコードかローカルで確認
  const myCode = await settingsRepository.getMyInviteCode();
  if (myCode === code) {
    return { success: false, error: 'own_code' };
  }

  try {
    const db = getFirestore();

    // コードを検索
    const q = query(collection(db, COLLECTION_NAME), where('code', '==', code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'not_found' };
    }

    const inviterDoc = snapshot.docs[0];
    const inviterData = inviterDoc.data() as {
      code: string;
      codeUsed: boolean;
    };

    // 自分のコードかFirestore側でも確認
    if (inviterDoc.id === deviceId) {
      return { success: false, error: 'own_code' };
    }

    // 既に使用済みのコード
    if (inviterData.codeUsed) {
      return { success: false, error: 'already_used' };
    }

    // 自分のドキュメントを確認（既にコード入力済みか）
    const myDocRef = doc(db, COLLECTION_NAME, deviceId);
    const myDocSnap = await getDoc(myDocRef);

    if (myDocSnap.exists()) {
      const myData = myDocSnap.data() as { redeemedCode: string | null };
      if (myData.redeemedCode !== null) {
        return { success: false, error: 'already_redeemed' };
      }
    }

    // トランザクションで両者のドキュメントを更新
    const inviterDocRef = doc(db, COLLECTION_NAME, inviterDoc.id);

    await runTransaction(db, async (transaction) => {
      const freshInviterSnap = await transaction.get(inviterDocRef);
      if (!freshInviterSnap.exists()) {
        throw new Error('not_found');
      }

      const freshInviterData = freshInviterSnap.data() as { codeUsed: boolean };
      if (freshInviterData.codeUsed) {
        throw new Error('already_used');
      }

      // 招待者のドキュメントを更新
      transaction.update(inviterDocRef, {
        codeUsed: true,
        usedBy: deviceId,
        usedAt: serverTimestamp(),
      });

      // 被招待者のドキュメントを更新（なければ作成）
      if (myDocSnap.exists()) {
        transaction.update(myDocRef, {
          redeemedCode: code,
          redeemedAt: serverTimestamp(),
        });
      } else {
        const myNewCode = generateCode();
        transaction.set(myDocRef, {
          code: myNewCode,
          codeUsed: false,
          createdAt: serverTimestamp(),
          usedBy: null,
          usedAt: null,
          redeemedCode: code,
          redeemedAt: serverTimestamp(),
        });
        // ローカルキャッシュに保存（トランザクション外で実行）
        settingsRepository.setMyInviteCode(myNewCode);
      }
    });

    // ローカルに倍速ブーストを保存
    await settingsRepository.setInviteSpeedBoost(true);
    usePurchaseStore.getState().setInviteSpeedBoost(true);

    return { success: true };
  } catch (error: any) {
    if (isPermissionDenied(error)) {
      return { success: false, error: 'service_suspended' };
    }
    if (error.message === 'not_found') {
      return { success: false, error: 'not_found' };
    }
    if (error.message === 'already_used') {
      return { success: false, error: 'already_used' };
    }
    console.error('[InviteCode] Redeem failed:', error);
    return { success: false, error: 'network_error' };
  }
};

/**
 * 招待者報酬を確認（自分のコードが使われたかチェック）
 * 設定画面を開いた時に呼ぶ
 */
export const checkInviterReward = async (): Promise<boolean> => {
  // 既にローカルで有効化済みなら確認不要
  const alreadyEnabled = await settingsRepository.getInviteSpeedBoost();
  if (alreadyEnabled) return true;

  try {
    const deviceId = await getDeviceId();
    const db = getFirestore();
    const docRef = doc(db, COLLECTION_NAME, deviceId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return false;

    const data = docSnap.data() as {
      usedBy: string | null;
      redeemedCode: string | null;
    };

    // 自分のコードが使われた、または自分がコードを入力済み
    if (data.usedBy !== null || data.redeemedCode !== null) {
      await settingsRepository.setInviteSpeedBoost(true);
      usePurchaseStore.getState().setInviteSpeedBoost(true);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[InviteCode] Check inviter reward failed:', error);
    return false;
  }
};
