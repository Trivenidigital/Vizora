import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, Flex, Image } from '@chakra-ui/react';
import { FiMail, FiLock } from 'react-icons/fi';
import logoImage from '../../assets/favicon.svg';
import { setAuth } from '../../utils/auth';
import { useAuth } from '../../contexts/AuthContext';

// Helper function to create fetch request with timeout
const fetchWithTimeout = async (resource: string, options: RequestInit = {}, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server did not respond in time');
    }
    throw error;
  }
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const { updateUser } = useAuth();
  
  // Get the page user was trying to access before being redirected to login
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Validate inputs
    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setIsLoading(false);
      return;
    }

    try {
      // Use a relative URL with timeout to avoid infinite loading
      const response = await fetchWithTimeout(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }, 15000); // 15 second timeout

      console.log('Login response status:', response.status);
      
      // Safely handle the response even if it's empty
      let data;
      const responseText = await response.text();
      
      try {
        // Only try to parse if there's actual content
        data = responseText ? JSON.parse(responseText) : {};
        console.log('Login response data:', data);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError, 'Response text:', responseText);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Check if we have the expected data structure
      if (!data.data || !data.data.token || !data.data.user) {
        console.error('Invalid response structure:', data);
        throw new Error('Invalid response from server');
      }

      // Save authentication data using our utility
      setAuth(data.data.token, data.data.user);
      
      // Update auth context
      updateUser(data.data.user);

      // Show success message
      toast({
        title: 'Success',
        description: 'Login successful!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Redirect to the page user was trying to access or dashboard
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      
      // Show error message with more specific information
      toast({
        title: 'Login Failed',
        description: error.message || 'An error occurred during login',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box bg="white" p={8} rounded="md" shadow="md" maxW="400px" w="full">
        <VStack spacing={6} align="center" mb={6}>
          <Image src={logoImage} alt="Vizora Logo" maxW="150px" />
          <Heading as="h1" size="xl">Welcome Back</Heading>
          <Text color="gray.500">Sign in to your account</Text>
        </VStack>
        
        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl id="email" isRequired>
              <FormLabel>Email</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiMail color="gray.400" />
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Enter your email"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <FormControl id="password" isRequired>
              <FormLabel>Password</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiLock color="gray.400" />
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Enter your password"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <Button 
              type="submit" 
              colorScheme="blue" 
              size="lg" 
              width="full" 
              mt={4} 
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </VStack>
        </form>
        
        <Text mt={6} textAlign="center">
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#3182CE', fontWeight: 'bold' }}>
            Sign Up
          </Link>
        </Text>
      </Box>
    </Flex>
  );
};

export default Login;
