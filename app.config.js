const { validateReleaseEnvironment } = require("./scripts/release-config.cjs");

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === "production") {
    const problems = validateReleaseEnvironment(process.env);
    if (problems.length)
      throw new Error(`正式版設定尚未完成：\n${problems.join("\n")}`);
  }
  const appId = process.env.SLOWDAY_APP_ID;
  const projectId = process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId;
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(appId ? { bundleIdentifier: appId } : {}),
    },
    android: {
      ...config.android,
      ...(appId ? { package: appId } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
