/**
 * キャラクターのビルドスナップショット生成。
 *
 * デバッグメニューの「ビルドJSON」出力（app/debug.tsx）と、
 * UberUberクラーケンのクリア記録（lib/ranking.ts → Firestore）で
 * 同一フォーマットを共有するためのユーティリティ。
 * どちらか一方だけ変更してフォーマットがずれるのを防ぐ。
 */

import { Equipment, PetInstance } from '@/types';

/** ペット1体分のスナップショット（強化レベルを付与） */
export type PetSnapshot = PetInstance & { level: number };

/** デバッグJSON / クリア記録で共有するビルドスナップショット */
export interface CharacterBuildSnapshot {
  level: number;
  equipment: Equipment;
  activePet: PetSnapshot | null;
  pets: PetSnapshot[];
  activePetInstanceId: string | null;
  petLevels: Record<string, number>;
  unlockedSkills: string[];
  unlockedUberSkills: string[];
  uberPoints: number;
}

export interface BuildSnapshotInput {
  level: number;
  equipment: Equipment;
  pets: PetInstance[];
  activePetInstanceId: string | null;
  petLevels: Record<string, number>;
  unlockedSkills: string[];
  unlockedUberSkills: string[];
  uberPoints: number;
}

/**
 * 現在のビルド状態からスナップショットを組み立てる。
 * ペットには petLevels から解決した強化レベル（未登録はLv1）を付与する。
 */
export function buildCharacterBuildSnapshot(input: BuildSnapshotInput): CharacterBuildSnapshot {
  const activePet = input.pets.find((pet) => pet.instanceId === input.activePetInstanceId) ?? null;

  return {
    level: input.level,
    equipment: input.equipment,
    activePet: activePet
      ? { ...activePet, level: input.petLevels[activePet.petId] ?? 1 }
      : null,
    pets: input.pets.map((pet) => ({
      ...pet,
      level: input.petLevels[pet.petId] ?? 1,
    })),
    activePetInstanceId: input.activePetInstanceId,
    petLevels: input.petLevels,
    unlockedSkills: input.unlockedSkills,
    unlockedUberSkills: input.unlockedUberSkills,
    uberPoints: input.uberPoints,
  };
}
