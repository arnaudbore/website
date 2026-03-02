/**
 * Utility functions for detecting and fetching pipeline logos from GitHub repositories
 */

import { fileExists } from './github-api';

export interface PipelineLogo {
  type: 'light-dark' | 'single' | 'fallback';
  lightUrl?: string;
  darkUrl?: string;
  url?: string;
}

/**
 * Get the URL to the raw file from a GitHub repository
 * @param org Organization name
 * @param repo Repository name
 * @param path Path to file in repository
 * @returns Raw GitHub content URL
 */
function getRawGitHubUrl(org: string, repo: string, path: string): string {
  return `https://raw.githubusercontent.com/${org}/${repo}/main/${path}`;
}

/**
 * Detect the logo for a pipeline from its GitHub repository
 * Checks for:
 * 1. {name}-light-logo.png and {name}-dark-logo.png in assets/
 * 2. {name}-logo.png in assets/
 * 3. Falls back to local GitHub logo
 *
 * @param org Organization name
 * @param name Pipeline name
 * @returns Logo information
 */
export async function detectPipelineLogo(
  org: string,
  name: string
): Promise<PipelineLogo> {
  const lightPath = `assets/${name}-light-logo.png`;
  const alternLightPath = `assets/${name}-white-logo.png`; // Alternative naming convention
  const darkPath = `assets/${name}-dark-logo.png`;
  const singlePath = `assets/${name}-logo.png`;

  try {
    // Check for light/dark variants
    const hasDark = await fileExists(org, name, darkPath);
    const hasLight = await fileExists(org, name, lightPath);
    const hasAlternLight = await fileExists(org, name, alternLightPath);

    if ((hasLight || hasAlternLight) && hasDark) {
      return {
        type: 'light-dark',
        lightUrl: getRawGitHubUrl(org, name, hasLight ? lightPath : alternLightPath),
        darkUrl: getRawGitHubUrl(org, name, darkPath),
      };
    }

    // Check for single logo
    const hasSingle = await fileExists(org, name, singlePath);
    if (hasSingle) {
      return {
        type: 'single',
        url: getRawGitHubUrl(org, name, singlePath),
      };
    }
  } catch (error) {
    console.error(`Error detecting logo for ${org}/${name}:`, error);
  }

  // Fallback to GitHub logo (light/dark variants)
  return {
    type: 'light-dark',
    lightUrl: '/github-logo.svg',
    darkUrl: '/github-logo-dark.svg',
  };
}
