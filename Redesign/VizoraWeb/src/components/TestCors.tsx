import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Input, Card, Text, Spinner, Box, Flex, Heading, Divider } from '@chakra-ui/react';

const TestCors: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [apiHealthStatus, setApiHealthStatus] = useState<string>('Checking...');
  const [dbHealthStatus, setDbHealthStatus] = useState<string>('Checking...');
  const [loginStatus, setLoginStatus] = useState<string>('Not tested');
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(import.meta.env.VITE_API_URL || 'http://localhost:3003');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Test server health
    axios
      .get(`${baseUrl}/health`)
      .then((response) => {
        console.log('Health check response:', response.data);
        setHealthStatus(`OK: ${response.data.message || 'Server is running'}`);
      })
      .catch((err) => {
        console.error('Health check error:', err);
        setHealthStatus(`Error: ${err.message}`);
      });

    // Test API health
    axios
      .get(`${baseUrl}/api/health`)
      .then((response) => {
        console.log('API health check response:', response.data);
        setApiHealthStatus(`OK: ${response.data.message || 'API is running'}`);
      })
      .catch((err) => {
        console.error('API health check error:', err);
        setApiHealthStatus(`Error: ${err.message}`);
      });
      
    // Test database health
    axios
      .get(`${baseUrl}/api/db/health`)
      .then((response) => {
        console.log('DB health check response:', response.data);
        setDbHealthStatus(`OK: ${response.data.message || 'Database is connected'}`);
      })
      .catch((err) => {
        console.error('DB health check error:', err);
        if (err.response && err.response.status === 503) {
          setDbHealthStatus(`Error: Database connection unavailable`);
        } else {
          setDbHealthStatus(`Error: ${err.message}`);
        }
      });
  }, [baseUrl]);

  const testLogin = async () => {
    setIsLoading(true);
    setLoginStatus('Testing...');
    setError(null);
    
    try {
      const response = await axios.post(`${baseUrl}/api/auth/login`, {
        email: 'user@vizora.com',
        password: 'user123',
      });
      
      console.log('Login response:', response.data);
      setLoginStatus(`Success! Token: ${response.data.token.substring(0, 15)}...`);
    } catch (err) {
      console.error('Login test error:', err);
      let errorMessage = 'Unknown error';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Server responded with error
          const status = err.response.status;
          const message = err.response.data?.message;
          
          errorMessage = `Server error ${status}: ${message || err.message}`;
          
          if (status === 503) {
            errorMessage = 'Authentication service unavailable - Database connection required';
          }
        } else if (err.request) {
          // No response received
          errorMessage = 'No response from server - connection failed';
        } else {
          // Request setup error
          errorMessage = `Request error: ${err.message}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setLoginStatus(`Failed`);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={5}>
      <Heading size="lg" mb={4}>API Connection Test</Heading>
      <Card p={4} mb={4}>
        <Heading size="md" mb={2}>Test Configuration</Heading>
        <Flex mb={4}>
          <Text mr={2} width="100px" pt={2}>API URL:</Text>
          <Input 
            value={baseUrl} 
            onChange={(e) => setBaseUrl(e.target.value)} 
            placeholder="Enter API base URL" 
          />
        </Flex>
      </Card>

      <Card p={4} mb={4}>
        <Heading size="md" mb={2}>Server Health Status</Heading>
        <Flex>
          <Text width="200px" fontWeight="bold">Server:</Text>
          <Text color={healthStatus.includes('Error') ? 'red.500' : 'green.500'}>
            {healthStatus}
          </Text>
        </Flex>
        <Flex>
          <Text width="200px" fontWeight="bold">API:</Text>
          <Text color={apiHealthStatus.includes('Error') ? 'red.500' : 'green.500'}>
            {apiHealthStatus}
          </Text>
        </Flex>
        <Flex>
          <Text width="200px" fontWeight="bold">Database:</Text>
          <Text color={dbHealthStatus.includes('Error') ? 'red.500' : 'green.500'}>
            {dbHealthStatus}
          </Text>
        </Flex>
      </Card>

      <Card p={4} mb={4}>
        <Heading size="md" mb={2}>Login Test</Heading>
        <Button 
          onClick={testLogin} 
          colorScheme="blue" 
          isLoading={isLoading}
          mb={4}
        >
          Test Login
        </Button>
        <Flex>
          <Text width="200px" fontWeight="bold">Result:</Text>
          <Text color={loginStatus.includes('Success') ? 'green.500' : (loginStatus === 'Testing...' ? 'blue.500' : 'red.500')}>
            {loginStatus}
          </Text>
        </Flex>
        {error && (
          <Flex mt={2}>
            <Text width="200px" fontWeight="bold">Error:</Text>
            <Text color="red.500">{error}</Text>
          </Flex>
        )}
      </Card>
    </Box>
  );
};

export default TestCors; 