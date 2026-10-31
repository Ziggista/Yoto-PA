import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.ziggi.yotopa",
  appName: "Yoto-PA",
  webDir: "dist",
  plugins: {
    // Route fetch/XHR through native HTTP so calls to api.yotoplay.com and
    // login.yotoplay.com are not subject to WebView CORS rules.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
