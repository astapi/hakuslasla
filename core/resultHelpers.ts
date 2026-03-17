/**
 * Uberダンジョンで入場券がない場合に周回ボタンを無効化するか判定
 */
export const isRepeatDisabled = (
  isUberDungeon: boolean,
  uberTicketCount: number | null,
): boolean => {
  return isUberDungeon && (uberTicketCount === null || uberTicketCount <= 0);
};
