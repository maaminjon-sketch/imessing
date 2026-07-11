import { google } from "googleapis";
import { Readable } from "stream";
import { env } from "./env";

export function createGoogleOAuth2Client() {
  if (!env.googleClientId || !env.googleClientSecret || !env.googleRedirectUri) {
    throw new Error("Google Drive OAuth configuration is not available.");
  }

  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );
}

export function getGoogleDriveAuthUrl(state: string) {
  const oAuth2Client = createGoogleOAuth2Client();
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive.file",
      "openid",
      "profile",
      "email",
    ],
    state,
  });
}

export async function exchangeCodeForGoogleTokens(code: string) {
  const oAuth2Client = createGoogleOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

export async function getGoogleDriveUserInfo(tokens: any) {
  const oAuth2Client = createGoogleOAuth2Client();
  oAuth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: oAuth2Client, version: "v2" });
  const userInfo = await oauth2.userinfo.get();
  return userInfo.data;
}

export async function uploadChatBackupToDrive(tokens: any, fileName: string, content: Buffer) {
  const oAuth2Client = createGoogleOAuth2Client();
  oAuth2Client.setCredentials(tokens);

  const drive = google.drive({ version: "v3", auth: oAuth2Client });
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "application/json",
    },
    media: {
      mimeType: "application/json",
      body: Readable.from([content]),
    },
    fields: "id,name,webViewLink",
  });

  return response.data;
}
