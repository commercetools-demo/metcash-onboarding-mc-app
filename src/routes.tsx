import { Switch, Route, Redirect, useRouteMatch } from 'react-router-dom';
import NetworkList from './views/NetworkList';
import OnboardWizard from './views/OnboardWizard';
import StoreDetail from './views/StoreDetail';
import StoreCatalog from './views/StoreCatalog';
import OwnerView from './views/OwnerView';
import TemplateManagement from './views/TemplateManagement';

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

      <Redirect exact from={path} to={`${path}/network`} />
    </Switch>
  );
}
