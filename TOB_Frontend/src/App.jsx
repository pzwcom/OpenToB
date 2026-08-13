import { HashRouter, Redirect, Route, Switch } from 'react-router-dom'
import BuilderView from './pages/BuilderView.jsx'
import BuildHomePage from './pages/BuildHomePage.jsx'

export default function App() {
  return (
    <HashRouter>
      <Switch>
        <Route exact path="/" component={BuildHomePage} />
        <Route path="/builder" component={BuilderView} />
        <Route path="*" render={() => <Redirect to="/" />} />
      </Switch>
    </HashRouter>
  )
}
