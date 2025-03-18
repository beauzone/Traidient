// Debug file to list all available icons in lucide-react
import * as LucideIcons from 'lucide-react';

// Log the names of all available icons
console.log('Available icons in lucide-react:');
console.log(Object.keys(LucideIcons).sort());

// Check if Robot icon exists
if (LucideIcons['Robot']) {
  console.log('Robot icon exists');
} else {
  console.log('Robot icon does not exist');
  console.log('Consider using one of these similar icons:');
  
  // Suggest similar icons
  const similarIcons = Object.keys(LucideIcons).filter(name => 
    name.toLowerCase().includes('bot') || 
    name.toLowerCase().includes('cpu') || 
    name.toLowerCase().includes('chip') ||
    name.toLowerCase().includes('terminal')
  );
  
  console.log(similarIcons);
}