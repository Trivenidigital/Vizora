import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'react-hot-toast';
import { Loader2, Mail, Lock, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Updated Zod schema for business signup
const signUpSchema = z.object({
  businessName: z.string().min(1, { message: "Business name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

// Updated type based on new schema
type SignUpFormValues = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  onSignUpSuccess?: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSignUpSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: SignUpFormValues) => {
    setIsLoading(true);
    console.log("Business Signup Attempt:", data);
    
    try {
      const result = await signup(data);

      if (result.success) {
        toast.success('Account created successfully! Please log in.');
        reset();
        if (onSignUpSuccess) {
          onSignUpSuccess();
        }
      } else {
        toast.error(result.message || 'Sign up failed. Please try again.');
      }
    } catch (error: any) {
      console.error("Signup form error:", error);
      toast.error(error.message || 'An unexpected error occurred during sign up.');
    } finally {
      setIsLoading(false);
    }
  };

  // Log form state just before rendering
  console.log('Form State:', { isLoading, isDirty, isValid });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Business Name Field (Moved up, Renamed, Mandatory) */}
      <div className="space-y-1.5 relative">
        <Label htmlFor="businessName" className="text-xs font-medium text-slate-300">Business Name</Label>
        <Building className="absolute left-3 top-[2.3rem] transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          id="businessName"
          type="text"
          placeholder="Your Company Inc."
          autoComplete="organization"
          {...register("businessName")}
          disabled={isLoading}
           className={`w-full h-11 pl-10 pr-3 text-sm rounded-md bg-white/10 border ${errors.businessName ? 'border-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-white/30 focus:border-sky-400 focus:ring-sky-500/50'} focus:ring-1 focus:ring-offset-0 transition-colors duration-150 ease-in-out text-white placeholder:text-slate-400`}
        />
        {errors.businessName && <p className="text-xs text-red-400 pt-1">{errors.businessName.message}</p>}
      </div>

      {/* Email Field */}
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
           className={`w-full h-11 pl-10 pr-3 text-sm rounded-md bg-white/10 border ${errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-white/30 focus:border-sky-400 focus:ring-sky-500/50'} focus:ring-1 focus:ring-offset-0 transition-colors duration-150 ease-in-out text-white placeholder:text-slate-400`}
        />
        {errors.email && <p className="text-xs text-red-400 pt-1">{errors.email.message}</p>}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5 relative">
         <Label htmlFor="password" className="text-xs font-medium text-slate-300">Password</Label>
         <Lock className="absolute left-3 top-[2.3rem] transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
         <Input
           id="password"
           type="password"
           placeholder="••••••••"
           autoComplete="new-password"
           {...register("password")}
           disabled={isLoading}
            className={`w-full h-11 pl-10 pr-3 text-sm rounded-md bg-white/10 border ${errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-500/50' : 'border-white/30 focus:border-sky-400 focus:ring-sky-500/50'} focus:ring-1 focus:ring-offset-0 transition-colors duration-150 ease-in-out text-white placeholder:text-slate-400`}
         />
         {/* Show error OR helper text */}
         {errors.password ? (
           <p className="text-xs text-red-400 pt-1">{errors.password.message}</p>
         ) : (
           <p className="text-xs text-slate-400 pt-1">Must be at least 8 characters long.</p>
         )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading || !isValid}
        className="w-full h-11 mt-6 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm rounded-md shadow-sm transition-all duration-150 ease-in-out flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Creating Account...</span>
          </>
        ) : (
          'Sign Up'
        )}
      </Button>
    </form>
  );
}; 