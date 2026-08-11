/**
 * @type {import('@commercetools-frontend/application-config').ConfigOptions}
 *
 * Metcash Retailer Onboarding — MC Custom Application (RFP Section 6).
 * Runs inside Merchant Center on the logged-in user's session (no client secret).
 * Targets the SAME commercetools project as metcash-demo (the storefront).
 */
const config = {
  name: 'Retailer Onboarding',
  entryPointUriPath: '${env:ENTRY_POINT_URI_PATH}',
  cloudIdentifier: '${env:CLOUD_IDENTIFIER}',
  env: {
    production: {
      applicationId: '${env:CUSTOM_APPLICATION_ID}',
      url: '${env:APPLICATION_URL}',
    },
    development: {
      initialProjectKey: '${env:CTP_PROJECT_KEY}',
    },
  },
  oAuthScopes: {
    // view_key_value_documents is the legacy alias for view_custom_objects.
    // manage_products covers channels + product selections + inventory.
    view: [
      'view_stores',
      'view_products',
      'view_product_selections',
      'view_key_value_documents',
    ],
    manage: [
      'manage_stores',
      'manage_products',
      'manage_product_selections',
      'manage_key_value_documents',
    ],
  },
  icon: '${path:@commercetools-frontend/assets/application-icons/network.svg}',
  mainMenuLink: {
    defaultLabel: 'Retailer Onboarding',
    labelAllLocales: [],
    permissions: [],
  },
  submenuLinks: [
    {
      uriPath: 'network',
      defaultLabel: 'Network',
      labelAllLocales: [],
      permissions: [],
    },
    {
      uriPath: 'onboard',
      defaultLabel: 'Onboard a store',
      labelAllLocales: [],
      permissions: [],
    },
    {
      uriPath: 'templates',
      defaultLabel: 'Programme templates',
      labelAllLocales: [],
      permissions: [],
    },
    {
      uriPath: 'loyalty',
      defaultLabel: 'Loyalty & promotions',
      labelAllLocales: [],
      permissions: [],
    },
  ],
};

export default config;
