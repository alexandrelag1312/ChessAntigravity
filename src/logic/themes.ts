import type React from 'react';

export interface BoardTheme {
    id: string;
    name: string;
    lightSquare: string; // Used for the swatch preview
    darkSquare: string;  // Used for the swatch preview
    styleLight?: React.CSSProperties; // Applied to react-chessboard
    styleDark?: React.CSSProperties;  // Applied to react-chessboard
}

export const themes: BoardTheme[] = [
    {
        id: 'wood',
        name: 'Wood',
        lightSquare: '#DDB88C',
        darkSquare: '#A0785A',
        styleLight: { backgroundImage: 'url(/oak.jpg)', backgroundSize: 'cover' },
        styleDark: { backgroundImage: 'url(/walnut.jpg)', backgroundSize: 'cover' }
    },
    { id: 'classic', name: 'Classic', lightSquare: '#EBECD0', darkSquare: '#739552' },
    { id: 'red', name: 'Red', lightSquare: '#F2DFCA', darkSquare: '#B33D3D' },
    { id: 'purple', name: 'Purple', lightSquare: '#E1D5ED', darkSquare: '#8666A6' },
];

export const defaultTheme = themes.find(t => t.id === 'wood') || themes[0];
