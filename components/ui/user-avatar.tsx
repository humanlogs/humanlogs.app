import { cn } from "@/lib/utils";

type UserAvatarProps = {
  user: {
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  // Get user's initials
  const getUserInitial = () => {
    if (user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const sizeClasses = {
    sm: "w-5 h-5 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  const imageSizes = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden",
        sizeClasses[size],
        className,
      )}
    >
      {user.picture ? (
        <img
          src={user.picture}
          alt={user.name || user.email || "User"}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="object-cover w-full h-full"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center font-semibold">
          {getUserInitial()}
        </div>
      )}
    </div>
  );
}
