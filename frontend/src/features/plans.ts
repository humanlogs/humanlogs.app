import { useUser } from "./user/use-user";

const plans = [
  "free",
  "basic",
  "essential",
  "advanced",
  "business",
  "not_existing",
];

export type Plan =
  | "free"
  | "basic"
  | "essential"
  | "advanced"
  | "business"
  | "not_existing";

export const usePlanBetterOrEq = () => {
  const { user } = useUser();
  return (plan: Plan) => {
    return plans.indexOf(user?.data?.plan as any) >= plans.indexOf(plan);
  };
};
