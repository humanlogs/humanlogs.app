export type UserType = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  credits: number;
  lang: string;
  credits_used: number;
  plan: string;
  plan_credits: number;
  plan_renew_at: number;
  created_at: number;
  apple_pay_id: string | null;
  consent: boolean;
  consent_usage: {
    models: string[];
    styles: string[];
    images: string[];
  };
};
