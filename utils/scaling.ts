import { Dimensions, PixelRatio } from 'react-native';

// 基準となるデザイン幅（iPhone 13/14のサイズを基準）
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * 画面幅に基づいてスケーリング
 * デザイン基準幅（390px）に対する現在の画面幅の比率でスケール
 */
export const scale = (size: number): number => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * ratio));
};

/**
 * 画面高さに基づいてスケーリング
 */
export const verticalScale = (size: number): number => {
  const ratio = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * ratio));
};

/**
 * 適度なスケーリング（極端な変化を抑える）
 * factorが小さいほど変化が緩やか（デフォルト0.5）
 * フォントサイズやパディングに推奨
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const ratio = SCREEN_WIDTH / BASE_WIDTH;
  const newSize = size + (size * (ratio - 1) * factor);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * フォントサイズ用スケーリング（控えめ）
 */
export const fontScale = (size: number): number => {
  return moderateScale(size, 0.3);
};

/**
 * アイコンサイズ用スケーリング
 */
export const iconScale = (size: number): number => {
  return moderateScale(size, 0.4);
};

/**
 * 画面幅のパーセンテージを返す
 */
export const widthPercent = (percent: number): number => {
  return Math.round(SCREEN_WIDTH * (percent / 100));
};

/**
 * 画面高さのパーセンテージを返す
 */
export const heightPercent = (percent: number): number => {
  return Math.round(SCREEN_HEIGHT * (percent / 100));
};

/**
 * デバイスタイプの判定
 */
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isTablet = SCREEN_WIDTH >= 768;

/**
 * 画面サイズ情報
 */
export const screenInfo = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmallDevice,
  isTablet,
};

// 短縮エイリアス
export const s = scale;
export const vs = verticalScale;
export const ms = moderateScale;
export const fs = fontScale;
export const wp = widthPercent;
export const hp = heightPercent;
