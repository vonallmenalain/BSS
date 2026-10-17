import { Config } from "@remotion/cli/config";

// Gilt für `npm run studio` und `npx remotion render`.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setAudioBitrate("192k");
Config.setOverwriteOutput(true);
// Eigener Chromium (z.B. im Docker-Container auf dem NAS): REMOTION_BROWSER_EXECUTABLE setzen.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
