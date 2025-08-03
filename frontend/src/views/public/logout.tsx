import { useUser } from "@features/user/use-user";

export const Logout = () => {
  const { logout } = useUser();
  logout();
  return <></>;
};
