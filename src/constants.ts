import { entryPointUriPathToPermissionKeys } from '@commercetools-frontend/application-shell/ssr';

// Must match ENTRY_POINT_URI_PATH in .env / custom-application-config.mjs.
export const entryPointUriPath = 'retailer-onboarding';

// Generates { View: 'ViewRetailerOnboarding', Manage: 'ManageRetailerOnboarding' }.
export const PERMISSIONS = entryPointUriPathToPermissionKeys(entryPointUriPath);
