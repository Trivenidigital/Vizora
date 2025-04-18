import React from 'react';
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'destructive';
    children: React.ReactNode;
}
interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode;
}
interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode;
}
export declare const Alert: React.FC<AlertProps>;
export declare const AlertTitle: React.FC<AlertTitleProps>;
export declare const AlertDescription: React.FC<AlertDescriptionProps>;
export {};
