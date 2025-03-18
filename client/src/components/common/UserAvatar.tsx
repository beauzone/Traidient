import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types";

interface UserAvatarProps {
  user?: User | null;
  className?: string;
}

const UserAvatar = ({ user, className = "" }: UserAvatarProps) => {
  // Generate initials from user's name
  const getInitials = () => {
    if (!user?.name) return "?";
    
    const nameParts = user.name.split(" ");
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }
    
    return (
      nameParts[0].charAt(0).toUpperCase() + 
      nameParts[nameParts.length - 1].charAt(0).toUpperCase()
    );
  };

  // Determine background color based on user's name (for consistent colors)
  const getColorFromName = () => {
    if (!user?.name) return "hsl(var(--primary))";
    
    const colors = [
      "hsl(var(--primary))",
      "hsl(var(--secondary))",
      "hsl(var(--accent))",
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))"
    ];
    
    // Simple hash function to get consistent color for a name
    const hashCode = user.name.split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    return colors[hashCode % colors.length];
  };

  return (
    <Avatar className={className}>
      {/* If we had an actual image URL, we would use it here */}
      <AvatarImage src="" alt={user?.name || "User"} />
      <AvatarFallback 
        style={{ backgroundColor: getColorFromName() }}
        className="text-white"
      >
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
