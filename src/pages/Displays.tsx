import React, { useState } from 'react';
import { Box, Container, Heading, Button, useDisclosure, useToast } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import AddDisplayModal from '../components/displays/AddDisplayModal';
import UserDisplays from '../components/displays/UserDisplays';
import { getContentService, ContentUpdate } from "../services/contentService";

interface DisplaysProps {
  initialAddModalOpen?: boolean;
}

const Displays: React.FC<DisplaysProps> = ({ initialAddModalOpen = false }) => {
  const { isOpen, onOpen, onClose } = useDisclosure({ defaultIsOpen: initialAddModalOpen });
  const [selectedDisplay, setSelectedDisplay] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'image' | 'video' | 'text' | 'html'>('text');
  const [content, setContent] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const toast = useToast();

  const handlePushContent = async (displayId: string) => {
    if (!displayId) return;

    setIsPushing(true);

    try {
      const contentUpdate: ContentUpdate = {
        type: contentType,
        content: {}
      };

      switch (contentType) {
        case 'image':
          if (!content) {
            throw new Error('Please select an image from the library');
          }
          contentUpdate.content.url = content;
          break;
        case 'video':
          if (!content) {
            throw new Error('Please enter a URL for the video');
          }
          contentUpdate.content.url = content;
          break;
        case 'text':
          if (!content) {
            throw new Error('Please enter some text content');
          }
          contentUpdate.content.text = content;
          contentUpdate.content.fontSize = '24px';
          break;
        case 'html':
          if (!content) {
            throw new Error('Please enter some HTML content');
          }
          contentUpdate.content.html = content;
          break;
      }

      console.log('Pushing content to display:', displayId);
      const contentService = getContentService();
      const success = await contentService.pushContent(displayId, contentUpdate);
      
      if (success) {
        setContent('');
        alert('Content pushed successfully!');
      } else {
        throw new Error('Failed to push content');
      }
    } catch (error) {
      console.error('Error pushing content:', error);
      alert(error instanceof Error ? error.message : 'Failed to push content');
    } finally {
      setIsPushing(false);
    }
  };

  const handleDisplayAdded = (display: { displayId: string; name: string; status: 'Connected' | 'Disconnected' }) => {
    console.log('Display added:', display);
    toast({
      title: 'Display Added',
      description: `Successfully added display: ${display.name || display.displayId}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
    onClose();
    // Force refresh of UserDisplays component
    const event = new CustomEvent('refreshDisplays');
    window.dispatchEvent(event);
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Box mb={8}>
        <UserDisplays />
      </Box>

      {/* Add Display Modal */}
      {isOpen && (
        <AddDisplayModal
          isOpen={isOpen}
          onClose={onClose}
          onDisplayAdded={handleDisplayAdded}
        />
      )}
    </Container>
  );
};

export default Displays;
