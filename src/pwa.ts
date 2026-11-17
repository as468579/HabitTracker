export function isStandalone(displayMode: boolean, iosStandalone?: boolean) {
  return displayMode || iosStandalone === true;
}

export function isAppleMobile(
  userAgent: string,
  platform: string,
  touchPoints: number,
) {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
}
