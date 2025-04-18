import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define Zod schema for validation
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { 
    register, 
    handleSubmit, 
    formState: { errors }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur'
  });

  // Actual submit handler using react-hook-form
  const onSubmit = (data: LoginFormValues) => {
    console.log("Login Data:", data);
    // TODO: Implement actual login logic
  };

  return (
    // Main container - Two columns on large screens, specific gradient background
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 bg-gradient-to-br from-cyan-200 via-blue-300 to-purple-400 font-sans">
      
      {/* Left Side - Illustration Area */} 
      {/* Content centered, takes full height */} 
      <div className="hidden lg:flex flex-col items-center justify-center p-12">
        {/* Illustration Placeholder - Replace with actual SVG/Image */} 
        <div className="mb-6">
          {/* Placeholder mimicking template illustration's position and feel */}
          <div className="w-full max-w-md h-72 bg-white/30 rounded-lg shadow-lg flex items-center justify-center relative backdrop-blur-sm border border-white/20">
             <span className="text-slate-700 text-lg font-medium">[Illustration Placeholder]</span>
             {/* Example AI Bubble */} 
             <div className="absolute top-[-20px] right-[60px] bg-white rounded-full px-5 py-2 shadow-md font-semibold text-blue-600 text-lg">AI</div>
          </div>
        </div>
        <div className="text-center max-w-md">
          {/* Title and Subtitle from template, adjust text colors */}
          <h1 className="text-4xl font-bold mb-3 text-slate-800">AI-powered digital signage platform</h1>
          <p className="text-lg text-slate-600">
            Transform your displays with intelligent content management.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form Area */} 
      {/* Centered content vertically and horizontally */} 
      <div className="flex items-center justify-center p-6 sm:p-12">
        {/* Card container for the form, matching template styling */}
        <Card className="mx-auto w-full max-w-sm bg-white text-slate-900 shadow-xl rounded-lg border-none">
          {/* No CardHeader needed based on template */} 
          <CardContent className="p-6 sm:p-8">
            {/* Form using react-hook-form */} 
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-y-4">
              
              {/* Email Field */} 
              <div className="grid gap-1.5"> {/* Reduced gap */} 
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Password" // Placeholder text from template image
                  autoComplete="email"
                  {...register("email")}
                  className={`bg-white border ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/50'} focus:ring-1 h-11 px-3 text-slate-900 placeholder:text-slate-400 rounded-md`} 
                />
                {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
              </div>

              {/* Password Field */} 
              <div className="grid gap-1.5"> {/* Reduced gap */} 
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-slate-700">Password</Label>
                  <a
                    href="#" // Link to password reset page later
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Password" // Placeholder text from template image
                  autoComplete="current-password"
                  {...register("password")}
                  className={`bg-white border ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/50' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/50'} focus:ring-1 h-11 px-3 text-slate-900 placeholder:text-slate-400 rounded-md`}
                />
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              {/* Submit Button */} 
              <Button 
                type="submit" 
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 text-base mt-4 rounded-md shadow-sm h-11"
              >
                Log in
              </Button>
            </form>

            {/* Sign Up Link */} 
            <div className="mt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account?{" "}
              <a href="#" className="font-semibold text-blue-600 hover:underline"> 
                Sign up
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 