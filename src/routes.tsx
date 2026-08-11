import { Switch, Route, Redirect, useRouteMatch } from 'react-router-dom';
import NetworkList from './views/NetworkList';
import OnboardWizard from './views/OnboardWizard';
import StoreDetail from './views/StoreDetail';
import StoreCatalog from './views/StoreCatalog';
import OwnerView from './views/OwnerView';
import TemplateManagement from './views/TemplateManagement';
import LoyaltyManagement from './views/LoyaltyManagement';

// The MC App Kit mounts this app at /:projectKey/retailer-onboarding
export default function AppRoutes() {
  const { path } = useRouteMatch();

  return (
    <Switch>
      <Route path={`${path}/network/owner/:ownerKey`} component={OwnerView} />

      <Route path={`${path}/network/store/:storeKey/range`} component={StoreCatalog} />
      <Route path={`${path}/network/store/:storeKey`} component={StoreDetail} />

      <Route path={`${path}/network`} component={NetworkList} />
      <Route path={`${path}/onboard`} component={OnboardWizard} />

      <Route path={`${path}/templates`} component={TemplateManagement} />
      <Route path={`${path}/loyalty`} component={LoyaltyManagement} />

      {/*
        Catch-all LAST: without it an unmatched path renders nothing at all, so a typo'd
        submenu uriPath (or a stale bundle missing a route) shows a blank screen with no
        clue as to why. Redirecting to the network list always leaves the app usable.
      */}
      <Redirect to={`${path}/network`} />
    </Switch>
  );
}
