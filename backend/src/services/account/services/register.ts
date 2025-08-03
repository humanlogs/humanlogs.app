import config from "config";
import { Express } from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { v4 } from "uuid";
import Framework from "../../../platform";
import { Context, createContext, CtxReq } from "../../../types";
import { plansConfigurations } from "../../billing/services/credit-updater";
import { AccountsDefinition, AccountsType } from "../entities/accounts";

const jwtSecret = config.get("jwt.secret");
const appleClientId = config.get("apple.client_id");

const generateAppleClientSecret = () => {
  const privateKey = config
    .get<string>("apple.private_key")
    .replace(/;/gm, "\n");
  const teamId = config.get("apple.team_id");
  const keyId = config.get("apple.key_id");
  const clientId = config.get("apple.client_id");

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 3600, // 1 hour expiration
    aud: "https://appleid.apple.com",
    sub: clientId,
  };

  console.log(payload);

  return jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    keyid: keyId,
  });
};

const handleRegisterOrLogin = async (
  ctx: Context,
  platform: string,
  platform_id: string,
  email?: string,
  { name, avatar, lang, utm_source } = {} as {
    name?: string;
    avatar?: string;
    lang?: string;
    utm_source?: string;
  }
): Promise<AccountsType> => {
  const db = await Framework.Db.getService();
  const account = await db.selectOne<AccountsType>(
    ctx,
    AccountsDefinition.name,
    {
      platform,
      platform_id,
    }
  );

  if (account) {
    await db.update<AccountsType>(
      ctx,
      AccountsDefinition.name,
      { id: account.id },
      {
        last_login: Date.now(),
        ...(name ? { name } : {}),
        ...(avatar ? { avatar } : {}),
        email,
        lang: lang || ctx.lang,
      }
    );

    return account;
  } else {
    const newAccount: AccountsType = {
      id: v4(),
      platform,
      platform_id,
      name,
      avatar,
      email,
      credits: plansConfigurations.free.monthly_credits,
      credits_used: 0,
      created_at: Date.now(),
      last_login: Date.now(),
      stripe_id: "",
      apple_pay_id: "",
      stripe_email: "",
      plan: "free",
      plan_renew_at: 0,
      moderated: "",
      sent_discount_email: 0,
      last_discount_email: Date.now(),
      unsubscribed_discount_email: false,
      lang: lang || ctx.lang || "en",
      consent: false,
      consent_usage: {} as any,
      analytics: {
        features: [],
        sources: [],
      },
      utm_source: utm_source || "",
    };
    await db.insert(ctx, AccountsDefinition.name, newAccount);
    return newAccount as AccountsType;
  }
};

export const checkAuthenticated = async (req, res, next) => {
  // Get JWT token from the request
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.sendStatus(401);
  }
  // use jwt to verify the token
  const result = await new Promise((result) =>
    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        result(false);
        return;
      }
      req.user = user; // id and email
      if (req.ctx) {
        req.ctx.id = user.id;
        req.ctx.role = "USER";
      }
      result(true);
    })
  );

  if (!result) {
    return res.sendStatus(403);
  }

  return await next();
};

export const registerAccountRegisterRoutes = async (app: Express) => {
  app.post("/api/auth/google", async (req: CtxReq, res) => {
    const ctx = req.ctx || createContext();

    // Get token from body
    const token = req.body.token;
    let account: AccountsType;

    // Verify the token
    if (req.body.token.indexOf("redirect:") === 0) {
      const googleRes = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${
          token.split("redirect:")[1]
        }`
      );

      const googleResJson: any = await googleRes.json();
      if (googleResJson.error) {
        return res.sendStatus(401);
      }

      account = await handleRegisterOrLogin(
        ctx,
        "google",
        googleResJson.id,
        googleResJson.email,
        {
          name: googleResJson.name,
          avatar: googleResJson.picture,
          lang: googleResJson.locale,
          utm_source: req.body.options?.utm_source || "",
        }
      );
    } else {
      const tokenRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
      );

      const googleResJson: any = await tokenRes.json();
      if (googleResJson.error) {
        return res.sendStatus(401);
      }

      account = await handleRegisterOrLogin(
        ctx,
        "google",
        googleResJson.sub,
        googleResJson.email,
        {
          name: googleResJson.name,
          avatar: googleResJson.picture,
          lang: googleResJson.locale,
          utm_source: req.body.options?.utm_source || "",
        }
      );
    }

    // Create JWT token
    const jwtToken = jwt.sign(
      { id: account.id, email: account.email },
      jwtSecret
    );
    res.send({ token: jwtToken });
  });

  app.post("/api/auth/apple", async (req: CtxReq, res) => {
    const ctx = req.ctx || createContext();

    const token = req.body.token;
    if (!token) {
      console.error("No token provided");
      return res.sendStatus(400);
    }

    const body = new URLSearchParams({
      client_id: appleClientId as string,
      client_secret: generateAppleClientSecret(),
      code: token,
      grant_type: "authorization_code",
      redirect_uri: req.body.options?.redirect_url || "https://app.totext.app",
    });
    const appleRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const appleResJson: any = await appleRes.json();
    if (appleResJson.error) {
      console.error("Apple error", appleResJson);
      return res.sendStatus(401);
    }

    console.log("Apple response", appleResJson);

    const { id_token } = appleResJson;
    const decodedToken = jwt.decode(id_token) as any;
    console.log("Apple response", decodedToken);

    const account = await handleRegisterOrLogin(
      ctx,
      "apple",
      decodedToken.sub,
      decodedToken.email,
      {
        name: req.body.options?.name,
        lang: ctx.lang || "en",
        utm_source: req.body.options?.utm_source || "",
      }
    );

    const jwtToken = jwt.sign(
      { id: account.id, email: account.email },
      jwtSecret
    );
    res.send({ token: jwtToken });
  });
};
