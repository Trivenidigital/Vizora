import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Button, FormControl, FormLabel, Input, VStack, Heading, Text, useToast, Flex, Image, Checkbox } from '@chakra-ui/react';
import { FiUser, FiMail, FiLock, FiBriefcase } from 'react-icons/fi';
import logoImage from '../../assets/favicon.svg';
import { register as registerUser } from '../../utils/auth';
import { useAuth } from '../../contexts/AuthContext';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: '',
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { updateUser } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (!agreeToTerms) {
      toast({
        title: 'Error',
        description: 'You must agree to the terms and conditions',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      console.log('Submitting registration form:', {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        // Don't log the actual password
        hasPassword: !!formData.password
      });
      
      // Use our auth utility to register
      const result = await registerUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        company: formData.company,
      });

      if (!result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      // If we want to automatically log in users, update the auth context
      if (result.user) {
        updateUser(result.user);
        
        // Show success message
        toast({
          title: 'Registration successful',
          description: 'Your account has been created successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        // Show success message for login redirect
        toast({
          title: 'Registration successful',
          description: 'Your account has been created successfully. Please login with your credentials.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Navigate to login page
        navigate('/login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Registration failed',
        description: error.message || 'An error occurred during registration',
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
      <Box bg="white" p={8} rounded="md" shadow="md" maxW="500px" w="full">
        <VStack spacing={4} align="center" mb={6}>
          <Image src={logoImage} alt="Vizora Logo" maxW="150px" />
          <Heading as="h1" size="xl">Create an Account</Heading>
          <Text color="gray.500">Join Vizora to manage your displays</Text>
        </VStack>
        
        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <FormControl id="name" isRequired>
              <FormLabel>Full Name</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiUser color="gray.400" />
                <Input 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <FormControl id="email" isRequired>
              <FormLabel>Email</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiMail color="gray.400" />
                <Input 
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <FormControl id="company">
              <FormLabel>Company (Optional)</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiBriefcase color="gray.400" />
                <Input 
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Enter your company name"
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <FormControl id="confirmPassword" isRequired>
              <FormLabel>Confirm Password</FormLabel>
              <Flex align="center" border="1px" borderColor="gray.200" rounded="md" px={3}>
                <FiLock color="gray.400" />
                <Input 
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  border="none"
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
            </FormControl>
            
            <FormControl>
              <Checkbox 
                colorScheme="blue" 
                isChecked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
              >
                I agree to the Terms of Service and Privacy Policy
              </Checkbox>
            </FormControl>
            
            <Button 
              type="submit" 
              colorScheme="blue" 
              size="lg" 
              width="full" 
              mt={4} 
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </VStack>
        </form>
        
        <Text mt={6} textAlign="center">
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#3182CE', fontWeight: 'bold' }}>
            Sign In
          </Link>
        </Text>
      </Box>
    </Flex>
  );
};

export default Register;
