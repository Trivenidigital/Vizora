import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button, Input, Card, Text, Spinner, Box, Flex, Heading, Divider, VStack, Code, Badge } from '@chakra-ui/react';

const TestCors: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string>('Checking...');
  const [apiHealthStatus, setApiHealthStatus] = useState<string>('Checking...');
  const [dbHealthStatus, setDbHealthStatus] = useState<string>('Checking...');
  const [loginStatus, setLoginStatus] = useState<string>('Not tested');
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(import.meta.env.VITE_API_URL || 'http://localhost:3003');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setDiagnosticLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  };

  const runHealthChecks = useCallback(async () => {
    setHealthStatus('Checking...');
    setApiHealthStatus('Checking...');
    setDbHealthStatus('Checking...');
    addLog('Running health checks...');
    
    // Test server health
    try {
      const response = await axios.get(`${baseUrl}/health`);
      console.log('Health check response:', response.data);
      setHealthStatus(`OK: ${response.data.message || 'Server is running'}`);
      addLog(`Server health check: OK (${response.status})`);
    } catch (err) {
      console.error('Health check error:', err);
      const errorMsg = axios.isAxiosError(err) && err.response 
        ? `Error ${err.response.status}: ${err.response.statusText}` 
        : `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setHealthStatus(`Error: ${errorMsg}`);
      addLog(`Server health check failed: ${errorMsg}`);
    }

    // Test API health
    try {
      const response = await axios.get(`${baseUrl}/api/health`);
      console.log('API health check response:', response.data);
      setApiHealthStatus(`OK: ${response.data.message || 'API is running'}`);
      addLog(`API health check: OK (${response.status})`);
    } catch (err) {
      console.error('API health check error:', err);
      const errorMsg = axios.isAxiosError(err) && err.response 
        ? `Error ${err.response.status}: ${err.response.statusText}` 
        : `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setApiHealthStatus(`Error: ${errorMsg}`);
      addLog(`API health check failed: ${errorMsg}`);
    }
      
    // Test database health
    try {
      const response = await axios.get(`${baseUrl}/api/db/health`);
      console.log('DB health check response:', response.data);
      setDbHealthStatus(`OK: ${response.data.message || 'Database is connected'}`);
      addLog(`Database health check: OK (${response.status})`);
    } catch (err) {
      console.error('DB health check error:', err);
      let errorMsg = 'Unknown error';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          errorMsg = `Error ${err.response.status}: ${err.response.data?.message || err.response.statusText}`;
          
          if (err.response.status === 503) {
            setDbHealthStatus(`Error: Database connection unavailable`);
            addLog(`Database health check: FAILED (503) - Database unavailable`);
            return;
          }
        } else if (err.request) {
          errorMsg = 'No response received';
          addLog(`Database health check: FAILED - No response received`);
        } else {
          errorMsg = err.message;
          addLog(`Database health check: FAILED - ${err.message}`);
        }
      } else if (err instanceof Error) {
        errorMsg = err.message;
        addLog(`Database health check: FAILED - ${err.message}`);
      }
      
      setDbHealthStatus(`Error: ${errorMsg}`);
    }
  }, [baseUrl]);

  useEffect(() => {
    runHealthChecks();
  }, [runHealthChecks]);

  const testLogin = async () => {
    setIsLoading(true);
    setLoginStatus('Testing...');
    setError(null);
    addLog('Testing login endpoint...');
    
    try {
      const response = await axios.post(`${baseUrl}/api/auth/login`, {
        email: 'user@vizora.com',
        password: 'user123',
      });
      
      console.log('Login response:', response.data);
      setLoginStatus(`Success! Token: ${response.data.token.substring(0, 15)}...`);
      addLog(`Login test: SUCCESS - Token received`);
    } catch (err) {
      console.error('Login test error:', err);
      let errorMessage = 'Unknown error';
      
      if (axios.isAxiosError(err)) {
        if (err.response) {
          // Server responded with error
          const status = err.response.status;
          const message = err.response.data?.message;
          
          errorMessage = `Server error ${status}: ${message || err.message}`;
          addLog(`Login test: FAILED - Status ${status} - ${message || 'No message'}`);
          
          if (status === 503) {
            errorMessage = 'Authentication service unavailable - Database connection required';
            addLog(`Login test: FAILED - Database connection required but unavailable`);
          }
        } else if (err.request) {
          // No response received
          errorMessage = 'No response from server - connection failed';
          addLog(`Login test: FAILED - No response from server`);
        } else {
          // Request setup error
          errorMessage = `Request error: ${err.message}`;
          addLog(`Login test: FAILED - Request setup error: ${err.message}`);
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
        addLog(`Login test: FAILED - ${err.message}`);
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
          <Button ml={2} colorScheme="blue" onClick={runHealthChecks} size="sm">
            Refresh
          </Button>
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
          isDisabled={dbHealthStatus.includes('Error')}
        >
          Test Login
        </Button>
        {dbHealthStatus.includes('Error') && (
          <Badge colorScheme="red" mb={4}>
            Login disabled: Database not available
          </Badge>
        )}
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
      
      <Card p={4} mb={4}>
        <Heading size="md" mb={2}>Diagnostic Logs</Heading>
        <Box bg="gray.50" p={2} borderRadius="md" maxHeight="300px" overflowY="auto">
          <VStack align="stretch" spacing={1}>
            {diagnosticLogs.map((log, index) => (
              <Code key={index} fontSize="xs" p={1} borderRadius="sm">
                {log}
              </Code>
            ))}
          </VStack>
        </Box>
      </Card>
    </Box>
  );
};

export default TestCors; 