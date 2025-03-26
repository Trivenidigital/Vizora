import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Heading,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Badge,
  Button,
  Flex,
  Icon,
  useToast,
  Spinner,
  Center,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Input,
  FormControl,
  FormLabel,
  Textarea,
  RadioGroup,
  Radio,
  Stack,
  Divider,
  Image,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Grid
} from '@chakra-ui/react';
import { FiMonitor, FiMapPin, FiInfo, FiEdit, FiTrash2, FiPlus, FiSend, FiImage, FiVideo, FiFileText, FiFolder } from 'react-icons/fi';
import { authFetch, API_URL } from '../../utils/auth';
import { getContentService, ContentUpdate } from '../../services/contentService';
import { useNavigate } from 'react-router-dom';

interface Display {
  _id: string;
  displayId: string;
  name?: string;
  description?: string;
  location?: string;
  status: string;
  lastSeen: string;
  pairingCode: string;
}

interface ClaimDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: (pairingCode: string, name?: string, location?: string) => Promise<void>;
  isLoading: boolean;
}

interface PushContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  display: Display | null;
  onPushContent: (displayId: string, content: ContentUpdate) => Promise<void>;
  isLoading: boolean;
}

interface ContentItem {
  id: number;
  title: string;
  type: string;
  thumbnail?: string;
  url?: string;
  content?: string;
}

interface ContentSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  display: Display | null;
  onSelectContent: (contentItem: ContentItem) => void;
}

// Mock content items for the selection modal
const mockContentItems: ContentItem[] = [
  {
    id: 1,
    title: 'Welcome Video',
    type: 'video',
    thumbnail: 'https://via.placeholder.com/300x200?text=Welcome+Video',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    id: 2,
    title: 'Company Logo',
    type: 'image',
    thumbnail: 'https://via.placeholder.com/300x200?text=Company+Logo',
    url: 'https://via.placeholder.com/800x600?text=Company+Logo'
  },
  {
    id: 3,
    title: 'Welcome Message',
    type: 'text',
    content: 'Welcome to our digital signage system!'
  },
  {
    id: 4,
    title: 'Product Showcase',
    type: 'image',
    thumbnail: 'https://via.placeholder.com/300x200?text=Product',
    url: 'https://via.placeholder.com/800x600?text=Product+Showcase'
  },
  {
    id: 5,
    title: 'How-to Tutorial',
    type: 'video',
    thumbnail: 'https://via.placeholder.com/300x200?text=Tutorial',
    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
  },
  {
    id: 6,
    title: 'Announcement',
    type: 'text',
    content: 'Important company announcement: New features coming soon!'
  }
];

const PushContentModal: React.FC<PushContentModalProps> = ({ 
  isOpen, 
  onClose, 
  display, 
  onPushContent, 
  isLoading 
}) => {
  const [contentType, setContentType] = useState<'text' | 'image' | 'video' | 'html'>('text');
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [fontSize, setFontSize] = useState('24px');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#000000');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!display) return;
    
    const contentUpdate: ContentUpdate = {
      type: contentType,
      content: {}
    };
    
    switch (contentType) {
      case 'text':
        if (!textContent) {
          alert('Please enter text content');
          return;
        }
        contentUpdate.content = {
          text: textContent,
          fontSize,
          bgColor,
          textColor
        };
        break;
        
      case 'image':
        if (!imageUrl) {
          alert('Please enter an image URL');
          return;
        }
        contentUpdate.content = {
          url: imageUrl
        };
        break;
        
      case 'video':
        if (!videoUrl) {
          alert('Please enter a video URL');
          return;
        }
        contentUpdate.content = {
          url: videoUrl
        };
        break;
        
      case 'html':
        if (!htmlContent) {
          alert('Please enter HTML content');
          return;
        }
        contentUpdate.content = {
          html: htmlContent
        };
        break;
    }
    
    await onPushContent(display.displayId, contentUpdate);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Push Content to Display
          {display && (
            <Text fontSize="sm" fontWeight="normal" mt={1} color="gray.600">
              {display.name || display.displayId}
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <FormControl mb={4}>
              <FormLabel>Content Type</FormLabel>
              <RadioGroup value={contentType} onChange={(val: any) => setContentType(val)}>
                <Stack direction="row" spacing={5}>
                  <Radio value="text">
                    <Flex align="center">
                      <Icon as={FiFileText} mr={2} />
                      Text
                    </Flex>
                  </Radio>
                  <Radio value="image">
                    <Flex align="center">
                      <Icon as={FiImage} mr={2} />
                      Image
                    </Flex>
                  </Radio>
                  <Radio value="video">
                    <Flex align="center">
                      <Icon as={FiVideo} mr={2} />
                      Video
                    </Flex>
                  </Radio>
                  <Radio value="html">
                    <Flex align="center">
                      <Icon as={FiFileText} mr={2} />
                      HTML
                    </Flex>
                  </Radio>
                </Stack>
              </RadioGroup>
            </FormControl>
            
            <Divider mb={4} />
            
            {contentType === 'text' && (
              <>
                <FormControl mb={4}>
                  <FormLabel>Text Content</FormLabel>
                  <Textarea 
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Enter text to display"
                    rows={4}
                  />
                </FormControl>
                
                <SimpleGrid columns={3} spacing={4} mb={4}>
                  <FormControl>
                    <FormLabel>Font Size</FormLabel>
                    <Input 
                      value={fontSize}
                      onChange={(e) => setFontSize(e.target.value)}
                      placeholder="e.g. 24px"
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Background Color</FormLabel>
                    <Input 
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Text Color</FormLabel>
                    <Input 
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                    />
                  </FormControl>
                </SimpleGrid>
                
                <Box 
                  mt={4} 
                  p={4} 
                  borderWidth="1px" 
                  borderRadius="md" 
                  bg={bgColor}
                  color={textColor}
                  textAlign="center"
                  fontSize={fontSize}
                >
                  {textContent || 'Preview Text'}
                </Box>
              </>
            )}
            
            {contentType === 'image' && (
              <>
                <FormControl mb={4}>
                  <FormLabel>Image URL</FormLabel>
                  <Input 
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </FormControl>
                
                {imageUrl && (
                  <Box mt={4} textAlign="center">
                    <Text mb={2} fontSize="sm">Preview:</Text>
                    <Image 
                      src={imageUrl} 
                      alt="Preview" 
                      maxH="200px" 
                      mx="auto"
                      fallback={<Box p={6} borderWidth="1px" borderRadius="md">Invalid image URL</Box>}
                    />
                  </Box>
                )}
              </>
            )}
            
            {contentType === 'video' && (
              <FormControl mb={4}>
                <FormLabel>Video URL</FormLabel>
                <Input 
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                />
                <Text mt={2} fontSize="sm" color="gray.600">
                  Supports direct MP4 links, YouTube and Vimeo URLs
                </Text>
              </FormControl>
            )}
            
            {contentType === 'html' && (
              <FormControl mb={4}>
                <FormLabel>HTML Content</FormLabel>
                <Textarea 
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder="<div>Your HTML content here</div>"
                  rows={8}
                  fontFamily="monospace"
                />
              </FormControl>
            )}
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              type="submit"
              isLoading={isLoading}
              leftIcon={<FiSend />}
            >
              Push Content
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const ClaimDisplayModal: React.FC<ClaimDisplayModalProps> = ({ isOpen, onClose, onClaim, isLoading }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onClaim(pairingCode, name, location);
    // Don't reset the form here as onClaim will close the modal on success
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Claim a Display</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <FormControl id="pairingCode" isRequired mb={4}>
              <FormLabel>Pairing Code</FormLabel>
              <Input 
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                placeholder="Enter the display's pairing code"
              />
            </FormControl>
            
            <FormControl id="displayName" mb={4}>
              <FormLabel>Display Name (Optional)</FormLabel>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Give this display a name"
              />
            </FormControl>
            
            <FormControl id="location">
              <FormLabel>Location (Optional)</FormLabel>
              <Input 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where is this display located?"
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              type="submit"
              isLoading={isLoading}
            >
              Claim Display
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const ContentSelectionModal: React.FC<ContentSelectionModalProps> = ({ 
  isOpen, 
  onClose, 
  display,
  onSelectContent
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const navigate = useNavigate();
  
  const handleGoToLibrary = () => {
    onClose();
    navigate('/content');
  };
  
  const renderContentItem = (item: ContentItem) => (
    <Box 
      key={item.id} 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden" 
      cursor="pointer"
      onClick={() => onSelectContent(item)}
      _hover={{ 
        shadow: 'md',
        borderColor: 'blue.500'
      }}
      transition="all 0.2s"
    >
      <Box height="120px" bg="gray.100" position="relative">
        {item.thumbnail ? (
          <Image 
            src={item.thumbnail} 
            alt={item.title}
            fallback={
              <Center height="100%">
                {item.type === 'video' && <FiVideo size={30} />}
                {item.type === 'image' && <FiImage size={30} />}
                {item.type === 'text' && <FiFileText size={30} />}
              </Center>
            }
            objectFit="cover"
            width="100%"
            height="100%"
          />
        ) : (
          <Center height="100%">
            {item.type === 'video' && <FiVideo size={30} />}
            {item.type === 'image' && <FiImage size={30} />}
            {item.type === 'text' && <FiFileText size={30} />}
          </Center>
        )}
        <Badge 
          position="absolute" 
          top="2" 
          right="2"
          colorScheme={
            item.type === 'video' ? 'red' :
            item.type === 'image' ? 'green' :
            'blue'
          }
        >
          {item.type}
        </Badge>
      </Box>
      <Box p="3">
        <Text fontWeight="semibold" isTruncated>
          {item.title}
        </Text>
      </Box>
    </Box>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Select Content for Display
          {display && (
            <Text fontSize="sm" fontWeight="normal" mt={1} color="gray.600">
              {display.name || display.displayId}
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <Tabs isFitted variant="enclosed" index={selectedTab} onChange={(index) => setSelectedTab(index)}>
            <TabList mb="1em">
              <Tab>Recent Content</Tab>
              <Tab>Create New</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Text mb={4}>Select content to push to this display:</Text>
                <Grid templateColumns="repeat(3, 1fr)" gap={4}>
                  {mockContentItems.map(item => renderContentItem(item))}
                </Grid>
                
                <Box textAlign="center" mt={6}>
                  <Button 
                    leftIcon={<FiFolder />} 
                    variant="outline" 
                    onClick={handleGoToLibrary}
                  >
                    Browse Full Library
                  </Button>
                </Box>
              </TabPanel>
              
              <TabPanel>
                <FormControl mb={4}>
                  <FormLabel>Content Type</FormLabel>
                  <RadioGroup defaultValue="text">
                    <Stack direction="row" spacing={5}>
                      <Radio value="text">
                        <Flex align="center">
                          <Icon as={FiFileText} mr={2} />
                          Text
                        </Flex>
                      </Radio>
                      <Radio value="image">
                        <Flex align="center">
                          <Icon as={FiImage} mr={2} />
                          Image
                        </Flex>
                      </Radio>
                      <Radio value="video">
                        <Flex align="center">
                          <Icon as={FiVideo} mr={2} />
                          Video
                        </Flex>
                      </Radio>
                    </Stack>
                  </RadioGroup>
                </FormControl>
                
                <FormControl mb={4}>
                  <FormLabel>Text Content</FormLabel>
                  <Textarea 
                    placeholder="Enter text to display"
                    rows={4}
                  />
                </FormControl>
                
                <Button colorScheme="blue" width="100%">
                  Create and Push
                </Button>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const UserDisplays: React.FC = () => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [pushContentLoading, setPushContentLoading] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const { isOpen: isClaimOpen, onOpen: onClaimOpen, onClose: onClaimClose } = useDisclosure();
  const { isOpen: isPushOpen, onOpen: onPushOpen, onClose: onPushClose } = useDisclosure();
  const { isOpen: isContentSelectionOpen, onOpen: onContentSelectionOpen, onClose: onContentSelectionClose } = useDisclosure();
  const toast = useToast();

  const fetchDisplays = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authFetch(`${API_URL}/displays`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch displays');
      }
      
      const data = await response.json();
      setDisplays(data.data.displays || []);
    } catch (error) {
      console.error('Error fetching displays:', error);
      setError(error.message || 'Error fetching your displays');
      toast({
        title: 'Error',
        description: error.message || 'Failed to load displays',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisplays();
    
    // Add event listener for refreshing displays
    const handleRefreshDisplays = () => {
      console.log('Refreshing displays due to custom event');
      fetchDisplays();
    };
    
    window.addEventListener('refreshDisplays', handleRefreshDisplays);
    
    // Clean up the event listener
    return () => {
      window.removeEventListener('refreshDisplays', handleRefreshDisplays);
    };
  }, []);

  const handleClaimDisplay = async (pairingCode: string, name?: string, location?: string) => {
    setClaimLoading(true);
    
    try {
      const response = await authFetch(`${API_URL}/displays/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pairingCode: pairingCode.toUpperCase(),
          name: name || undefined,
          location: location || undefined
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to claim display');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh displays list
        await fetchDisplays();
        
        toast({
          title: 'Success',
          description: 'Display claimed successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Close the modal
        onClaimClose();
      } else {
        throw new Error(data.message || 'Failed to claim display');
      }
    } catch (error) {
      console.error('Error claiming display:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to claim display',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setClaimLoading(false);
    }
  };

  const handlePushContent = async (displayId: string, content: ContentUpdate) => {
    setPushContentLoading(true);
    
    try {
      if (!displayId) {
        throw new Error('No display ID provided');
      }
      
      console.log(`Pushing content to display ${displayId}:`, content);
      
      const contentService = getContentService();
      const success = await contentService.pushContent(displayId, content);
      
      if (!success) {
        throw new Error('Content service returned failure status');
      }
      
      toast({
        title: 'Content Pushed',
        description: 'Content has been successfully sent to the display',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onPushClose();
      onContentSelectionClose();
    } catch (error) {
      console.error('Error pushing content:', error);
      
      // Provide more descriptive error message to the user
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      
      toast({
        title: 'Error Pushing Content',
        description: `Failed to push content: ${errorMessage}. Please check the connection to the middleware server.`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setPushContentLoading(false);
    }
  };

  const handleReleaseDisplay = async (displayId: string) => {
    if (!confirm('Are you sure you want to release this display? You will no longer be able to control it.')) {
      return;
    }
    
    try {
      const response = await authFetch(`${API_URL}/displays/${displayId}/release`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to release display');
      }
      
      // Refresh displays list
      await fetchDisplays();
      
      toast({
        title: 'Success',
        description: 'Display released successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error releasing display:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to release display',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const openPushContentModal = (display: Display) => {
    setSelectedDisplay(display);
    onContentSelectionOpen();
  };

  const handleContentSelected = (contentItem: ContentItem) => {
    if (!selectedDisplay) return;
    
    // Convert ContentItem to ContentUpdate format
    let contentUpdate: ContentUpdate;
    
    switch (contentItem.type) {
      case 'image':
        contentUpdate = {
          type: 'image',
          content: {
            url: contentItem.url,
            title: contentItem.title,
            description: `Image content: ${contentItem.title}`
          },
          metadata: {
            source: 'user_selection',
            timestamp: Date.now()
          }
        };
        break;
        
      case 'video':
        contentUpdate = {
          type: 'video',
          content: {
            url: contentItem.url,
            title: contentItem.title,
            description: `Video content: ${contentItem.title}`
          },
          metadata: {
            source: 'user_selection',
            timestamp: Date.now()
          }
        };
        break;
        
      case 'text':
        contentUpdate = {
          type: 'text',
          content: {
            text: contentItem.content || '',
            title: contentItem.title,
            description: `Text content: ${contentItem.title}`,
            fontSize: '24px',
            bgColor: '#ffffff',
            textColor: '#000000'
          },
          metadata: {
            source: 'user_selection',
            timestamp: Date.now()
          }
        };
        break;
        
      default:
        toast({
          title: 'Error',
          description: `Unsupported content type: ${contentItem.type}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
    }
    
    console.log('Pushing content to display:', selectedDisplay.displayId, contentUpdate);
    
    // Close the content selection modal
    onContentSelectionClose();
    
    // Push content to the selected display
    handlePushContent(selectedDisplay.displayId, contentUpdate);
  };

  if (isLoading) {
    return (
      <Center h="200px">
        <Spinner size="xl" color="blue.500" />
      </Center>
    );
  }

  if (error) {
    return (
      <Box p={4} textAlign="center">
        <Text color="red.500" fontSize="lg">{error}</Text>
        <Button mt={4} onClick={fetchDisplays}>Try Again</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">My Displays</Heading>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onClaimOpen}>
          Claim Display
        </Button>
      </Flex>

      {displays.length === 0 ? (
        <Box p={8} textAlign="center" borderWidth="1px" borderRadius="lg">
          <Icon as={FiMonitor} boxSize={10} color="gray.400" mb={4} />
          <Text fontSize="lg" mb={4}>You don't have any displays yet</Text>
          <Button colorScheme="blue" onClick={onClaimOpen}>
            Claim Your First Display
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {displays.map(display => (
            <Card key={display._id} borderWidth="1px">
              <CardHeader>
                <Flex justifyContent="space-between" alignItems="center">
                  <Heading size="md">{display.name || 'Unnamed Display'}</Heading>
                  <Badge colorScheme={
                    display.status === 'connected' ? 'green' :
                    display.status === 'paired' ? 'blue' :
                    'gray'
                  }>
                    {display.status}
                  </Badge>
                </Flex>
              </CardHeader>
              
              <CardBody>
                <Flex direction="column" gap={2}>
                  <Flex alignItems="center">
                    <Icon as={FiMapPin} mr={2} color="gray.500" />
                    <Text>{display.location || 'No location set'}</Text>
                  </Flex>
                  <Flex alignItems="center">
                    <Icon as={FiInfo} mr={2} color="gray.500" />
                    <Text>{display.description || 'No description'}</Text>
                  </Flex>
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    Last seen: {new Date(display.lastSeen).toLocaleString()}
                  </Text>
                </Flex>
              </CardBody>
              
              <CardFooter>
                <Flex justifyContent="space-between" width="100%" gap={2}>
                  <Button 
                    colorScheme="blue" 
                    leftIcon={<FiSend />} 
                    size="sm"
                    onClick={() => openPushContentModal(display)}
                    isDisabled={display.status !== 'connected' && display.status !== 'paired'}
                    flex="1"
                  >
                    Push Content
                  </Button>
                  <Button 
                    variant="outline" 
                    colorScheme="red" 
                    leftIcon={<FiTrash2 />} 
                    size="sm"
                    onClick={() => handleReleaseDisplay(display._id)}
                  >
                    Release
                  </Button>
                </Flex>
              </CardFooter>
            </Card>
          ))}
        </SimpleGrid>
      )}
      
      <ClaimDisplayModal 
        isOpen={isClaimOpen} 
        onClose={onClaimClose} 
        onClaim={handleClaimDisplay}
        isLoading={claimLoading}
      />
      
      <PushContentModal
        isOpen={isPushOpen}
        onClose={onPushClose}
        display={selectedDisplay}
        onPushContent={handlePushContent}
        isLoading={pushContentLoading}
      />
      
      <ContentSelectionModal
        isOpen={isContentSelectionOpen}
        onClose={onContentSelectionClose}
        display={selectedDisplay}
        onSelectContent={handleContentSelected}
      />
    </Box>
  );
};

export default UserDisplays; 