import React, { useState, useEffect } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { 
  Box, Button, Checkbox, Container, Divider, FormControl, 
  FormLabel, Heading, HStack, Input, InputGroup, InputRightElement, 
  Stack, Text, useColorModeValue, Link, Alert, AlertIcon, AlertTitle, AlertDescription,
  useToast, Flex
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/ui/Logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isServiceUnavailable, setIsServiceUnavailable] = useState(false);
  
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset any previous errors
    setLoginError(null);
    setIsServiceUnavailable(false);
    
    if (!email.trim() || !password.trim()) {
      setLoginError('Please enter both email and password');
      return;
    }
    
    try {
      // Login with timeout handling built into the AuthContext
      await login(email, password);
      // If successful, useEffect will handle redirect
    } catch (error) {
      console.error('Login error caught in page component:', error);
      
      // Display a user-friendly error message
      if (error instanceof Error) {
        const errorMessage = error.message;
        setLoginError(errorMessage);
        
        // Check if this is a service unavailable error
        if (errorMessage.includes('unavailable') || errorMessage.includes('service')) {
          setIsServiceUnavailable(true);
          
          // Show a toast notification as well
          toast({
            title: 'Authentication Service Unavailable',
            description: 'Our authentication service is temporarily down. Please try again later.',
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top'
          });
        }
      } else {
        setLoginError('Login failed. Please try again later.');
      }
    }
  };
  
  return (
    <Flex direction="column" width="100%">
      <Stack spacing="6">
        {isServiceUnavailable ? (
          <Alert 
            status="error" 
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            borderRadius="md"
            p={4}
          >
            <AlertIcon boxSize="40px" mr={0} />
            <AlertTitle mt={4} mb={1} fontSize="lg">
              Authentication Service Unavailable
            </AlertTitle>
            <AlertDescription maxWidth="sm">
              Our system is currently experiencing technical difficulties.
              Please try again later or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        ) : loginError ? (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
        ) : null}
        
        <form onSubmit={handleSubmit}>
          <Stack spacing="5">
            <FormControl isRequired>
              <FormLabel htmlFor="email">Email</FormLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isServiceUnavailable}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel htmlFor="password">Password</FormLabel>
              <InputGroup>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isServiceUnavailable}
                />
                <InputRightElement h={'full'}>
                  <Button
                    variant={'ghost'}
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isServiceUnavailable}
                  >
                    {showPassword ? <ViewIcon /> : <ViewOffIcon />}
                  </Button>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            
            <HStack justify="space-between">
              <Checkbox
                isChecked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading || isServiceUnavailable}
              >
                Remember me
              </Checkbox>
              <Link as={RouterLink} to="/forgot-password" color="blue.500" fontSize="sm">
                Forgot password?
              </Link>
            </HStack>
            
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={isLoading}
              loadingText="Signing in..."
              size="lg"
              w="100%"
              mt={4}
              disabled={isLoading || isServiceUnavailable || !email.trim() || !password.trim()}
            >
              Sign in
            </Button>
          </Stack>
        </form>
        
        <HStack my={4}>
          <Divider />
          <Text color="gray.500" fontSize="sm" whiteSpace="nowrap">
            OR
          </Text>
          <Divider />
        </HStack>
        
        <Text textAlign="center">
          Don't have an account?{' '}
          <Link as={RouterLink} to="/register" color="blue.500">
            Sign up
          </Link>
        </Text>
      </Stack>
    </Flex>
  );
};

export default LoginPage; 