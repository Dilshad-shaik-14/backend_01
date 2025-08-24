import { app } from './app.js';
import serverless from 'serverless-http';

export const handler = async (req, res) => {
  // Ensure every request is passed to serverless correctly
  return serverless(app)(req, res);
};
