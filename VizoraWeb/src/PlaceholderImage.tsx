import React from 'react';

interface PlaceholderImageProps {
  width?: number;
  height?: number;
  text?: string;
  bgColor?: string;
  textColor?: string;
}

const PlaceholderImage: React.FC<PlaceholderImageProps> = ({
  width = 300,
  height = 200,
  text = 'Placeholder',
  bgColor = '#CBD5E1',
  textColor = '#64748B'
}) => {
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '0.5rem',
        color: textColor,
        fontSize: '1rem',
        fontWeight: 500
      }}
    >
      {text}
    </div>
  );
};

export default PlaceholderImage; 