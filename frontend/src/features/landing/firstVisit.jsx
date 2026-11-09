import React from 'react';
import { Navigate } from 'react-router-dom';

const KEY = 'gg-visited';

export function hasVisited() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // storage blocked: never trap the user on the landing page
  }
}

export function markVisited() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Sends first-time visitors of `/` to the /welcome landing page once. */
export function FirstVisitGate({ children }) {
  if (!hasVisited()) return <Navigate to="/welcome" replace />;
  return children;
}
