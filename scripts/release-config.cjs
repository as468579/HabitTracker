function validateReleaseEnvironment(env) {
  const errors = [];
  if (
    !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(env.SLOWDAY_APP_ID || "") ||
    /(^|\.)(example|placeholder)(\.|$)/.test(env.SLOWDAY_APP_ID || "")
  )
    errors.push("SLOWDAY_APP_ID：請設定已確認歸屬的正式反向網域識別碼。");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL || ""))
    errors.push("EXPO_PUBLIC_SUPPORT_EMAIL：請填寫公開客服信箱。");
  if (!env.EXPO_PUBLIC_PUBLISHER_NAME?.trim())
    errors.push("EXPO_PUBLIC_PUBLISHER_NAME：請填寫發行者名稱。");
  for (const name of ["EXPO_PUBLIC_PRIVACY_URL", "EXPO_PUBLIC_SUPPORT_URL"]) {
    try {
      const url = new URL(env[name]);
      if (
        url.protocol !== "https:" ||
        !url.hostname.includes(".") ||
        /(^|\.)(localhost|example|invalid|test)(\.|$)/.test(url.hostname) ||
        /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
      )
        throw new Error();
    } catch {
      errors.push(`${name}：請填寫已公開的正式 HTTPS 網址。`);
    }
  }
  return errors;
}
module.exports = { validateReleaseEnvironment };
