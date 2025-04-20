import { fetch } from "@tauri-apps/plugin-http";
import { GoCardlessAccessToken } from "./schema";
import { Stronghold } from "@/lib/stronghold";

const ACCESS_TOKEN_KEY = "gocardless-access-token";
const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

export const init = async () => {
  const stronghold = await Stronghold.init();
  const accessToken = await stronghold.get(ACCESS_TOKEN_KEY);

  if (accessToken) {
    return;
  }
  const secretId = import.meta.env.VITE_GOCARDLESS_SECRED_ID;
  const secretKey = import.meta.env.VITE_GOCARDLESS_SECRED_KEY;

  const newAccessToken = await getAccessToken(secretId, secretKey);
  await stronghold.insert(ACCESS_TOKEN_KEY, JSON.stringify(newAccessToken));

  await stronghold.save();

  return newAccessToken;
};

export const getAccessToken = async (
  secretId: string,
  secretKey: string
): Promise<GoCardlessAccessToken> => {
  const response = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  const { success, data } = GoCardlessAccessToken.safeParse(
    await response.json()
  );

  if (!success) {
    throw new Error("Invalid response");
  }

  return data;
};
