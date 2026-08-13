import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PureRideApp from './PureRideApp';

const root = document.getElementById('app');

if (root) {
    createRoot(root).render(
        <React.StrictMode>
            <BrowserRouter>
                <PureRideApp />
            </BrowserRouter>
        </React.StrictMode>
    );
}