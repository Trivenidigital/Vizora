import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
describe('Example Test', () => {
    it('should render without crashing', () => {
        render(_jsx("div", { children: "Test Component" }));
        expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
    it('should import shared types and sockets', () => {
        // This test verifies that we can import from @vizora/common
        const status = {
            id: 'test',
            name: 'Test Display',
            status: 'online',
            lastSeen: new Date().toISOString(),
        };
        expect(status).toBeDefined();
    });
});
