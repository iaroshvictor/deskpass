/**
 * Environment Configuration
 * This file provides environment-specific configuration for the application
 *
 * Development: Uses environment variables for local development
 * Production: Uses the old code (dynamic host detection)
 */

import { Meteor } from 'meteor/meteor';

export interface AppConfig {
  isDevelopment: boolean;
  devServerHost?: string;
  devServerPort?: string;
}

/**
 * Get the current environment configuration
 */
export const getConfig = (): AppConfig => {
  // Check if we're on the client or server
  const isDevelopment = Meteor.isClient
    ? Meteor.settings.public?.isDevelopment === true
    : process.env.NODE_ENV === 'development';

  const devServerHost = Meteor.isClient
    ? Meteor.settings.public?.devServerHost
    : process.env.DEV_SERVER_HOST;

  const devServerPort = Meteor.isClient
    ? Meteor.settings.public?.devServerPort
    : process.env.DEV_SERVER_PORT;

  return {
    isDevelopment,
    devServerHost,
    devServerPort,
  };
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return getConfig().isDevelopment;
};

