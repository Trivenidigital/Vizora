import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'react-hot-toast';
import { Loader2, Mail, Lock } from 'lucide-react'; // Icons
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

// Zod schema for validation
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface AuthFormProps {
  onLoginSuccess?: () => void; // Optional callback for successful login
}

export const AuthForm: React.FC<AuthFormProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth(); // Get login function from context

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid, isDirty }, // Destructure form state
    reset // Function to reset form
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur
  });

  // Actual submit handler
  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    console.log("Login Attempt:", data);
    
    try {
      // Call the login function from context
      const success = await login(/* pass credentials data if needed by context */);
      
      if (success) {
        toast.success('Login Successful!');
        reset(); // Reset form on success
        if (onLoginSuccess) {
          onLoginSuccess(); // Trigger callback for page-level redirect
        }
      } else {
        // Login function in context should handle error state/message if needed
        toast.error('Invalid email or password.'); 
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error('An unexpected error occurred during login.');
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Email Field - Adjusted for dark card */}
      <div className="space-y-1.5 relative">
        <Label htmlFor="email" className="text-xs font-medium text-slate-300">Email address</Label>
        <Mail className="absolute left-3 top-[2.3rem] transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          {...register("email")}
          disabled={isLoading}
          // Use bg-transparent or light bg, white text/placeholder, light border
          className={`w-full h-11 pl-10 pr-3 text-sm rounded-md bg-white/10 border ${errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-white/30 focus:border-sky-400 focus:ring-sky-500/50'} focus:ring-1 focus:ring-offset-0 transition-colors duration-150 ease-in-out text-white placeholder:text-slate-400`}
        />
        {errors.email && <p className="text-xs text-red-400 pt-1">{errors.email.message}</p>}
      </div>

      {/* Password Field - Adjusted for dark card */}
      <div className="space-y-1.5 relative">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-xs font-medium text-slate-300">Password</Label>
          <a
            href="#" // Link to password reset page later
            // Adjust link color for better contrast
            className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline"
            tabIndex={-1} // Improve accessibility if needed
          >
            Forgot password?
          </a>
        </div>
        <Lock className="absolute left-3 top-[2.3rem] transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input 
          id="password" 
          type="password" 
          placeholder="••••••••"
          autoComplete="current-password"
          {...register("password")}
          disabled={isLoading}
          // Use bg-transparent or light bg, white text/placeholder, light border
          className={`w-full h-11 pl-10 pr-3 text-sm rounded-md bg-white/10 border ${errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-white/30 focus:border-sky-400 focus:ring-sky-500/50'} focus:ring-1 focus:ring-offset-0 transition-colors duration-150 ease-in-out text-white placeholder:text-slate-400`}
        />
        {errors.password && <p className="text-xs text-red-400 pt-1">{errors.password.message}</p>}
      </div>

      {/* Submit Button - Maybe adjust color slightly? Keeping indigo for now */}
      <Button 
        type="submit" 
        disabled={isLoading || !isDirty || !isValid} // Disable if loading or form invalid/pristine
        className="w-full h-11 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Logging in...</span>
          </>
        ) : (
          'Log in'
        )}
      </Button>
    </form>
  );
}; 